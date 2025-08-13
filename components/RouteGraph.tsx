"use client";

import type { RouteHop } from "@/types/routing";
import Image from "next/image";

type TokenMeta = { symbol?: string; logoURI?: string };

function formatToken(value: string, meta?: TokenMeta): string {
  if (meta?.symbol) return meta.symbol.toUpperCase();
  const v = value.toLowerCase();
  if (v === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") return "ETH";
  if (value.startsWith("0x")) return `${value.slice(0, 6)}…${value.slice(-4)}`;
  return value.toUpperCase();
}

function colorFromString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 60% 45%)`;
}

export function RouteGraph({ hops, tokenMeta }: { hops: RouteHop[]; tokenMeta?: Record<string, TokenMeta> }) {
  if (!hops || hops.length === 0) return null;
  const tokens: string[] = [hops[0].tokenIn, ...hops.map((h) => h.tokenOut)];
  const metaFor = (addrOrSym: string): TokenMeta | undefined => tokenMeta?.[addrOrSym.toLowerCase()] || tokenMeta?.[addrOrSym];
  return (
    <div className="mt-2">
      <div className="flex items-center flex-wrap gap-2">
        {tokens.map((token, idx) => {
          const meta = metaFor(token);
          const chipColor = colorFromString(token.toLowerCase());
          const label = formatToken(token, meta);
          const labelChar = label?.[0]?.toUpperCase() || "?";
          return (
            <div key={`node-${idx}`} className="flex items-center gap-2">
              <span className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--surface)] border" style={{ borderColor: "var(--border)" }}>
                {meta?.logoURI ? (
                  <Image src={meta.logoURI} alt={meta.symbol || token} width={16} height={16} className="h-4 w-4 rounded-full object-cover" unoptimized />
                ) : (
                  <span className="h-4 w-4 rounded-full inline-flex items-center justify-center text-[10px]"
                    style={{ backgroundColor: chipColor }}>{labelChar}</span>
                )}
                <span>{label}</span>
              </span>
              {idx < tokens.length - 1 && <span className="text-[#9fb0c5]">→</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-1 text-[11px] text-[#9fb0c5] flex flex-wrap gap-4">
        {hops.map((h, i) => (
          <span key={`edge-${i}`}>[{h.poolId}{h.feeBps ? ` · ${h.feeBps} bps` : ""}]</span>
        ))}
      </div>
    </div>
  );
} 