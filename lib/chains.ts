export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  42161: "Arbitrum One",
  11155111: "Sepolia",
  421614: "Arbitrum Sepolia",
  10: "Optimism",
  11155420: "Optimism Sepolia",
  8453: "Base",
  84532: "Base Sepolia",
  999: "Hyperliquid",
};

export function getChainName(chainId: number): string {
  return CHAIN_NAMES[chainId] || `Chain ${chainId}`;
} 