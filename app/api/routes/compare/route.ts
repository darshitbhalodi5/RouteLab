import { NextRequest } from "next/server";
import { BuildRouteRequest, CompareRoutesResponse, NormalizedRouteQuote } from "@/types/routing";
import { getGluexRouteQuote } from "@/lib/providers/gluex";
import { getLifiRouteQuote } from "@/lib/providers/lifi";

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

  const [gluex, lifi]: [NormalizedRouteQuote, NormalizedRouteQuote] = await Promise.all([
    getGluexRouteQuote(request).catch((e) => fallback("gluex", String(e))),
    getLifiRouteQuote(request).catch((e) => fallback("lifi", String(e))),
  ]);

  const payload: CompareRoutesResponse = { gluex, lifi };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
} 