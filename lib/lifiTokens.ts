export type TokenMeta = { symbol?: string; logoURI?: string; address?: string };

const LIFI_BASE_URL = process.env.LIFI_BASE_URL;

export async function fetchLifiTokenMeta(chainId: number): Promise<Record<string, TokenMeta>> {
  const url = new URL("/v1/tokens", LIFI_BASE_URL);
  url.searchParams.set("chains", String(chainId));
  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!res.ok) return {};
  const data: unknown = await res.json();
  const list = readPath<unknown[]>(data, ["tokens", String(chainId)]) || [];
  const out: Record<string, TokenMeta> = {};
  for (const t of list) {
    if (!t || typeof t !== "object") continue;
    const obj = t as Record<string, unknown>;
    const addr = typeof obj.address === "string" ? obj.address.toLowerCase() : "";
    const sym = typeof obj.symbol === "string" ? obj.symbol : undefined;
    const logo = typeof obj.logoURI === "string" ? obj.logoURI : (typeof obj.logoUrl === "string" ? obj.logoUrl : undefined);
    const meta: TokenMeta = { symbol: sym, logoURI: logo, address: addr };
    if (addr) out[addr] = meta;
    if (sym) out[sym] = meta;
    if (sym) out[sym.toLowerCase()] = meta;
  }
  out["0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"] = { symbol: "ETH", logoURI: undefined };
  return out;
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