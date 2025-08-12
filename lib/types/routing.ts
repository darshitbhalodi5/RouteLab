export type ChainId = number;

export interface BuildRouteRequest {
  chainId: ChainId;
  tokenIn: string; // address or symbol for now
  tokenOut: string; // address or symbol for now
  amountIn: string; // decimal string
  slippageBps: number; // basis points, e.g., 50 = 0.5%
}

export interface RouteHop {
  poolId: string;
  tokenIn: string;
  tokenOut: string;
  feeBps?: number;
}

export interface NormalizedRouteQuote {
  success: boolean;
  provider: "gluex" | "lifi";
  reason?: string;
  expectedOut: string; // decimal string
  priceImpactBps?: number;
  gasEstimate?: string;
  hops: RouteHop[];
  fees?: {
    totalBps?: number;
    breakdown?: Record<string, number>;
  };
  raw?: unknown; // provider raw response for debugging
}

export interface CompareRoutesResponse {
  gluex?: NormalizedRouteQuote;
  lifi?: NormalizedRouteQuote;
} 