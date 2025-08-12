import { BuildRouteRequest, NormalizedRouteQuote } from "../types/routing";

export async function getLifiRouteQuote(
  req: BuildRouteRequest
): Promise<NormalizedRouteQuote> {
  // TODO: Replace with real LI.FI API/Widget integration.
  // For now, return a deterministic stub that depends on token symbols and amount.
  const mockOut = (Number(req.amountIn) * 0.985).toFixed(6);
  return {
    success: true,
    provider: "lifi",
    expectedOut: mockOut,
    priceImpactBps: 40,
    gasEstimate: "180000",
    hops: [
      {
        poolId: "lifi-mock-hop-1",
        tokenIn: req.tokenIn,
        tokenOut: req.tokenOut,
        feeBps: 40,
      },
    ],
    fees: { totalBps: 40, breakdown: { protocol: 40 } },
    raw: { note: "stubbed lifi response" },
  };
} 