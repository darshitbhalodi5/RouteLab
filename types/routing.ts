export type ChainId = number;

export interface BuildRouteRequest {
  chainId: ChainId;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippageBps: number;
  fromAddress?: string;
  toAddress?: string;
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
  expectedOut: string;
  priceImpactBps?: number;
  gasEstimate?: string;
  hops: RouteHop[];
  fees?: {
    totalBps?: number;
    breakdown?: Record<string, number>;
  };
  raw?: unknown;
}

export interface CompareRoutesResponse {
  gluex?: NormalizedRouteQuote;
  lifi?: NormalizedRouteQuote;
} 