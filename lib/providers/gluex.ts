import { BuildRouteRequest, NormalizedRouteQuote, RouteHop } from "@/types/routing";
import { toBaseUnits, fromBaseUnits } from "@/lib/units";
import { resolveToken } from "@/lib/tokenResolver";

const GLUEX_BASE_URL = process.env.GLUEX_BASE_URL;
const GLUEX_API_KEY = process.env.GLUEX_API_KEY;
const GLUEX_UNIQUE_PID = process.env.GLUEX_UNIQUE_PID;

const GLUEX_CHAIN_ID_MAP: Record<number, string> = {
  1: "ethereum",
  42161: "arbitrum-one",
  10: "optimism",
  8453: "base",
  11155111: "sepolia",
  421614: "arbitrum-sepolia",
  11155420: "optimism-sepolia",
  84532: "base-sepolia",
};

function getGluexChainSlug(chainId: number): string | undefined {
  return GLUEX_CHAIN_ID_MAP[chainId];
}

export async function getGluexRouteQuote(req: BuildRouteRequest): Promise<NormalizedRouteQuote> {
  if (!GLUEX_BASE_URL || !GLUEX_API_KEY) {
    return {
      success: false,
      provider: "gluex",
      reason: "GlueX not configured. Set GLUEX_BASE_URL and GLUEX_API_KEY in .env.local",
      expectedOut: "0",
      hops: [],
    };
  }

  const chainName = getGluexChainSlug(req.chainId);
  if (!chainName) {
    return {
      success: false,
      provider: "gluex",
      reason: "Please select a supported chain.",
      expectedOut: "0",
      hops: [],
    };
  }

  const fromTok = await resolveToken(req.chainId, req.tokenIn);
  const toTok = await resolveToken(req.chainId, req.tokenOut);
  const inputAmount = toBaseUnits(req.amountIn, fromTok.decimals);

  const userAddress = (req.fromAddress || "").trim();
  const outputReceiver = (req.toAddress || userAddress).trim();

  const uniquePID = GLUEX_UNIQUE_PID!;
  const url = new URL("/v1/quote", GLUEX_BASE_URL);

  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
    "x-api-key": GLUEX_API_KEY,
  };

  let res: Response;
  try {
    const body = JSON.stringify({
      chainID: chainName,
      inputToken: fromTok.address.toLowerCase(),
      outputToken: toTok.address.toLowerCase(),
      inputAmount,
      orderType: "SELL",
      userAddress,
      outputReceiver,
      uniquePID,
    });
    res = await fetch(url.toString(), { method: "POST", headers, body, next: { revalidate: 0 } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      provider: "gluex",
      reason: `GlueX endpoint unreachable: ${msg}`,
      expectedOut: "0",
      hops: [],
    };
  }

  const rawData: unknown = await res.json().catch(async () => ({ error: await safeText(res) }));
  if (!res.ok) {
    const text = typeof rawData === "object" && rawData !== null ? JSON.stringify(rawData) : String(rawData);
    const reason = normalizeGluexError(res.status, text);
    return { success: false, provider: "gluex", reason, expectedOut: "0", hops: [] };
  }

  const dataRoot = unwrapResult(rawData);

  const toAmountRaw =
    readPath<string>(dataRoot, ["toAmount"]) ||
    readPath<string>(dataRoot, ["outputAmount"]) ||
    readPath<string>(dataRoot, ["amountOut"]) ||
    readPath<string>(dataRoot, ["outputTokenAmount"]) ||
    readPath<string>(dataRoot, ["quote", "toAmount"]) ||
    readPath<string>(dataRoot, ["quote", "outputAmount"]) ||
    undefined;

  const expectedOut = toAmountRaw ? toDecimalString(toAmountRaw, toTok.decimals) : "0";

  let hops: RouteHop[] = extractHops(dataRoot, fromTok.address, toTok.address);

  if (hops.length === 0) {
    const pathTokens =
      readPath<string[]>(dataRoot, ["tokensPath"]) ||
      readPath<string[]>(dataRoot, ["pathTokens"]) ||
      null;
    if (Array.isArray(pathTokens) && pathTokens.length >= 2) {
      const seq = pathTokens;
      const built: RouteHop[] = [];
      for (let i = 0; i < seq.length - 1; i++) {
        built.push({ poolId: "gluex", tokenIn: seq[i], tokenOut: seq[i + 1] });
      }
      hops = built;
    }
  }

  if (hops.length === 0) {
    const tool =
      readPath<string>(dataRoot, ["tool"]) ||
      readPath<string>(dataRoot, ["protocol"]) ||
      readPath<string>(dataRoot, ["router"]) ||
      readPath<string>(dataRoot, ["name"]) ||
      "gluex";
    hops = [{ poolId: tool, tokenIn: fromTok.address, tokenOut: toTok.address }];
  }

  const gasEstimate = readPath<string>(dataRoot, ["gas"]) || readPath<string>(dataRoot, ["estimate", "gas"]) || undefined;
  const priceImpactBps = readPath<number>(dataRoot, ["priceImpactBps"]) || undefined;

  return {
    success: true,
    provider: "gluex",
    expectedOut,
    priceImpactBps,
    gasEstimate,
    hops,
    raw: rawData,
  };
}

function normalizeGluexError(status: number, text: string): string {
  const lower = text.toLowerCase();
  if (status === 401 || status === 403) return "GlueX unauthorized (check API key)";
  if (status === 429 || lower.includes("rate")) return "GlueX rate limited";
  if (status === 400 && (lower.includes("invalid") || lower.includes("bad request"))) return "GlueX invalid request";
  if (status === 404) return "GlueX route not found";
  if (status >= 500) return "GlueX server error";
  return text || `HTTP ${status}`;
}

function unwrapResult(data: unknown): unknown {
  if (typeof data === "object" && data !== null) {
    const status = (data as Record<string, unknown>)["statusCode"];
    const result = (data as Record<string, unknown>)["result"];
    if (typeof status === "number" && result && typeof result === "object") {
      return result as unknown;
    }
  }
  return data;
}

function extractHops(root: unknown, fallbackIn: string, fallbackOut: string): RouteHop[] {
  const hops: RouteHop[] = [];
  const legs = readPath<unknown[]>(root, ["route", "legs"]) || readPath<unknown[]>(root, ["hops"]) || readPath<unknown[]>(root, ["path"]) || [];
  if (Array.isArray(legs)) {
    for (const leg of legs) {
      const tokenInAddr = readPath<string>(leg, ["tokenIn", "address"]) || readPath<string>(leg, ["inputToken"]) || fallbackIn;
      const tokenOutAddr = readPath<string>(leg, ["tokenOut", "address"]) || readPath<string>(leg, ["outputToken"]) || fallbackOut;
      const poolId = String(readPath<string>(leg, ["poolId"]) || readPath<string>(leg, ["tool"]) || readPath<string>(leg, ["protocol"]) || "gluex");
      const feeBpsVal = readPath<number>(leg, ["feeBps"]);
      const feeBps = typeof feeBpsVal === "number" ? feeBpsVal : undefined;
      hops.push({ poolId, tokenIn: tokenInAddr, tokenOut: tokenOutAddr, feeBps });
    }
  }
  return hops;
}

function toDecimalString(amountRaw: string, decimals: number): string {
  if (amountRaw.includes(".")) return amountRaw;
  return fromBaseUnits(amountRaw, decimals);
}

function readPath<T>(root: unknown, path: Array<string | number>): T | undefined {
  let curr: unknown = root;
  for (const seg of path) {
    if (typeof seg === "number") {
      if (!Array.isArray(curr) || seg < 0 || seg >= curr.length) return undefined;
      curr = curr[seg];
    } else {
      if (typeof curr !== "object" || curr === null || !(seg in curr)) return undefined;
      curr = (curr as Record<string, unknown>)[seg];
    }
  }
  return curr as T | undefined;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return `HTTP ${res.status}`;
  }
} 