export function normalizeAddressForChain(chainId: number, input: string): string {
  const raw = input.trim().toLowerCase();
  if (!raw.startsWith("0x")) throw new Error("Address must start with 0x");
  const hex = raw.slice(2);
  if (chainId === 999) {
    if (!/^[0-9a-f]*$/.test(hex)) throw new Error("Invalid hex characters in address");
    if (hex.length === 0 || hex.length > 40) throw new Error("Invalid HyperEVM address length");
    const padded = hex.padStart(40, "0");
    return "0x" + padded;
  }
  if (!/^[0-9a-f]{40}$/.test(hex)) throw new Error("Invalid EVM address length");
  return raw;
}

export function isProbablyAddressForChain(chainId: number, input: string): boolean {
  try {
    normalizeAddressForChain(chainId, input);
    return true;
  } catch {
    return false;
  }
} 