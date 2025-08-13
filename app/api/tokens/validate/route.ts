import { NextRequest } from "next/server";
import { fetchErc20Metadata } from "@/lib/erc20";
import { normalizeAddressForChain } from "@/lib/address";

const NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { chainId?: number; address?: string };
    const chainId = Number(body.chainId);
    const addressRaw = String(body.address || "");

    if (!chainId || !addressRaw) {
      return Response.json({ ok: false, reason: "Missing chainId or address" }, { status: 400 });
    }

    if (addressRaw.toLowerCase() === NATIVE) {
      return Response.json({ ok: true, erc20: false, native: true, address: NATIVE, symbol: "ETH", decimals: 18 });
    }

    if (chainId === 999) {
      try {
        const address = normalizeAddressForChain(chainId, addressRaw);
        return Response.json({ ok: true, erc20: true, address });
      } catch {
        return Response.json({ ok: true, erc20: false, address: addressRaw });
      }
    }
    let address: string;
    try {
      address = normalizeAddressForChain(chainId, addressRaw);
    } catch (e) {
      return Response.json({ ok: false, reason: String((e as Error).message || e) }, { status: 200 });
    }
    try {
      const meta = await fetchErc20Metadata(chainId, address);
      return Response.json({ ok: true, erc20: true, ...meta });
    } catch (e) {
      return Response.json({ ok: false, reason: String((e as Error).message || e) }, { status: 200 });
    }
  } catch {
    return Response.json({ ok: false, reason: "Invalid request" }, { status: 400 });
  }
} 