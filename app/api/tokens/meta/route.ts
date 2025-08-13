import { NextRequest } from "next/server";
import { fetchLifiTokenMeta } from "@/lib/lifiTokens";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chainIdStr = searchParams.get("chainId");
  const chainId = chainIdStr ? Number(chainIdStr) : NaN;
  if (!chainIdStr || Number.isNaN(chainId)) {
    return Response.json({ error: "Missing or invalid chainId" }, { status: 400 });
  }
  try {
    const meta = await fetchLifiTokenMeta(chainId);
    return Response.json({ meta }, { status: 200 });
  } catch (e) {
    return Response.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
} 