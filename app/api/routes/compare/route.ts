import { NextRequest } from "next/server";
import { BuildRouteRequest, CompareRoutesResponse, NormalizedRouteQuote } from "@/types/routing";
import { getGluexRouteQuote } from "@/lib/providers/gluex";
import { getLifiRouteQuote } from "@/lib/providers/lifi";
import { recordCompareMetric } from "@/lib/metrics";
import { cacheGet, cacheSet } from "@/lib/cache";
import { rateLimitHit } from "@/lib/rateLimit";

const CACHE_TTL_MS = 5_000; // cache identical requests for 5s
const RL_WINDOW_MS = 10_000; // 10s window
const RL_LIMIT = 20; // 20 requests per window per IP

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<BuildRouteRequest>;
  const required = ["chainId", "tokenIn", "tokenOut", "amountIn", "slippageBps"] as const;
  for (const key of required) {
    if (body[key] === undefined || body[key] === null) {
      return new Response(JSON.stringify({ error: `Missing field: ${key}` }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
  }

  const request: BuildRouteRequest = {
    chainId: body.chainId as number,
    tokenIn: String(body.tokenIn),
    tokenOut: String(body.tokenOut),
    amountIn: String(body.amountIn),
    slippageBps: Number(body.slippageBps),
    fromAddress: body.fromAddress ? String(body.fromAddress) : undefined,
    toAddress: body.toAddress ? String(body.toAddress) : undefined,
  };

  // Rate limit per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimitHit(ip, RL_LIMIT, RL_WINDOW_MS);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  }

  // Cache check
  const cacheKey = JSON.stringify({
    c: request.chainId,
    i: request.tokenIn.toLowerCase(),
    o: request.tokenOut.toLowerCase(),
    a: request.amountIn,
    s: request.slippageBps,
    f: request.fromAddress?.toLowerCase() || "",
    t: request.toAddress?.toLowerCase() || "",
  });
  const cached = cacheGet<CompareRoutesResponse>(cacheKey);
  if (cached) {
    try { console.debug("compare cache hit", cacheKey); } catch {}
    return new Response(JSON.stringify(cached), {
      status: 200,
      headers: { "content-type": "application/json", "x-cache": "HIT" },
    });
  }

  const fallback = (provider: "gluex" | "lifi", reason: string): NormalizedRouteQuote => ({
    success: false,
    provider,
    reason,
    expectedOut: "0",
    hops: [],
  });

  let gluexMs = 0;
  let lifiMs = 0;

  const gluexStart = Date.now();
  const gluexPromise: Promise<NormalizedRouteQuote> = getGluexRouteQuote(request)
    .catch((e) => fallback("gluex", String(e)))
    .then((res) => {
      gluexMs = Date.now() - gluexStart;
      return res;
    });

  const lifiStart = Date.now();
  const lifiPromise: Promise<NormalizedRouteQuote> = getLifiRouteQuote(request)
    .catch((e) => fallback("lifi", String(e)))
    .then((res) => {
      lifiMs = Date.now() - lifiStart;
      return res;
    });

  const [gluex, lifi]: [NormalizedRouteQuote, NormalizedRouteQuote] = await Promise.all([
    gluexPromise,
    lifiPromise,
  ]);

  const payload: CompareRoutesResponse = { gluex, lifi, metrics: { gluexMs, lifiMs } };

  try {
    recordCompareMetric({ gluexSuccess: gluex.success, lifiSuccess: lifi.success, gluexMs, lifiMs });
  } catch {}

  try {
    console.info(
      JSON.stringify({
        ts: new Date().toISOString(),
        routeCompare: {
          chainId: request.chainId,
          tokenIn: request.tokenIn,
          tokenOut: request.tokenOut,
          amountIn: request.amountIn,
        },
        gluex: { success: gluex.success, expectedOut: gluex.expectedOut, ms: gluexMs },
        lifi:  { success: lifi.success,  expectedOut: lifi.expectedOut,  ms: lifiMs  },
      })
    );
  } catch {}

  // Cache set
  try { cacheSet(cacheKey, payload, CACHE_TTL_MS); } catch {}

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json", "x-cache": "MISS" },
  });
} 