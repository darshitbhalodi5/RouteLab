import { NextRequest } from "next/server";
import { BuildRouteRequest, CompareRoutesResponse, NormalizedRouteQuote } from "@/types/routing";
import { getGluexRouteQuote } from "@/lib/providers/gluex";
import { getLifiRouteQuote } from "@/lib/providers/lifi";
import { recordCompareMetric } from "@/lib/metrics";

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
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        routeCompare: {
          chainId: request.chainId,
          tokenIn: request.tokenIn,
          tokenOut: request.tokenOut,
          amountIn: request.amountIn,
        },
        gluex: {
          success: gluex.success,
          expectedOut: gluex.expectedOut,
          ms: gluexMs,
        },
        lifi: {
          success: lifi.success,
          expectedOut: lifi.expectedOut,
          ms: lifiMs,
        },
      })
    );
  } catch {}

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
} 