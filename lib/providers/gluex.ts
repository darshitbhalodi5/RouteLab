import { BuildRouteRequest, NormalizedRouteQuote } from "../types/routing";

export async function getGluexRouteQuote(
  req: BuildRouteRequest
): Promise<NormalizedRouteQuote> {
  // TODO: Replace with real GlueX Router API integration.
  // For now, return a deterministic stub that depends on token symbols and amount.
  const mockOut = (Number(req.amountIn) * 0.99).toFixed(6);
  return {
    success: true,
    provider: "gluex",
    expectedOut: mockOut,
    priceImpactBps: 25,
    gasEstimate: "150000",
    hops: [
      {
        poolId: "gluex-mock-pool-1",
        tokenIn: req.tokenIn,
        tokenOut: req.tokenOut,
        feeBps: 30,
      },
    ],
    fees: { totalBps: 30, breakdown: { protocol: 30 } },
    raw: { note: "stubbed gluex response" },
  };
} 