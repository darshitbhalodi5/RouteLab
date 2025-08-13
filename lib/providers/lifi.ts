import { BuildRouteRequest, NormalizedRouteQuote, RouteHop } from "@/types/routing";
import { toBaseUnits, fromBaseUnits } from "@/lib/units";
import { resolveToken } from "@/lib/tokenResolver";

const LIFI_BASE_URL = process.env.LIFI_BASE_URL;
const NEXT_PUBLIC_DEFAULT_USER_ADDRESS = process.env.NEXT_PUBLIC_DEFAULT_USER_ADDRESS!;

export async function getLifiRouteQuote(req: BuildRouteRequest): Promise<NormalizedRouteQuote> {
  const from = await resolveToken(req.chainId, req.tokenIn);
  const to = await resolveToken(req.chainId, req.tokenOut);

  const fromAddress = (req.fromAddress || NEXT_PUBLIC_DEFAULT_USER_ADDRESS).trim();

  const fromAmount = toBaseUnits(req.amountIn, from.decimals);
  const url = new URL("/v1/quote", LIFI_BASE_URL);
  url.searchParams.set("fromChain", String(req.chainId));
  url.searchParams.set("toChain", String(req.chainId));
  url.searchParams.set("fromToken", from.address);
  url.searchParams.set("toToken", to.address);
  url.searchParams.set("fromAmount", fromAmount);
  url.searchParams.set("fromAddress", fromAddress);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) {
    const reason = await safeText(res);
    return { success: false, provider: "lifi", reason, expectedOut: "0", hops: [] };
  }
  const data: unknown = await res.json();

  const toAmount = readPath<string>(data, ["estimate", "toAmount"]);
  const expectedOut = toAmount ? fromBaseUnits(toAmount, to.decimals) : "0";

  const hops: RouteHop[] = [];
  const included = readPath<unknown[]>(data, ["includedSteps"]) || [];
  if (Array.isArray(included)) {
    for (const step of included) {
      const action = readObj(step, "action");
      const tool =
        readPath<string>(step, ["toolDetails", "key"]) || readObj(step, "tool") || "lifi";
      const tokenInAddr = readPath<string>(action, ["fromToken", "address"]) || from.address;
      const tokenOutAddr = readPath<string>(action, ["toToken", "address"]) || to.address;
      hops.push({ poolId: String(tool), tokenIn: tokenInAddr, tokenOut: tokenOutAddr });
    }
  }

  const gasEstimate = (() => {
    const gasCosts = readPath<unknown[]>(data, ["estimate", "gasCosts"]) || [];
    if (Array.isArray(gasCosts) && gasCosts.length > 0) {
      const first = gasCosts[0];
      const amt = readObj(first, "amount");
      return typeof amt === "string" ? amt : undefined;
    }
    return undefined;
  })();

  return {
    success: true,
    provider: "lifi",
    expectedOut,
    priceImpactBps: undefined,
    gasEstimate,
    hops,
    raw: data,
  };
}

function readObj(root: unknown, key: string): unknown {
  if (typeof root === "object" && root !== null && key in root) {
    return (root as Record<string, unknown>)[key];
  }
  return undefined;
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