"use client";

import { ALLOWED_CHAIN_IDS } from "@/lib/rpc";
import { CHAIN_NAMES } from "@/lib/chains";

export function ChainSelectorModal({
  open,
  onClose,
  onSelect,
  current,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (chainId: number) => void;
  current?: number;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="card w-full max-w-md overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-teal-500">
            <div className="flex items-center justify-between text-white">
              <h2 className="text-base font-semibold">Select Chain</h2>
              <button className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20" onClick={onClose}>Close</button>
            </div>
          </div>
          <div className="p-3 text-xs opacity-80" style={{ color: "var(--foreground)" }}>Choose a network to query quotes on.</div>
          <div className="max-h-[60vh] overflow-auto divide-y no-scrollbar" style={{ borderColor: "var(--border)" }}>
            {ALLOWED_CHAIN_IDS.map((id) => (
              <button
                key={id}
                className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between hover:bg-white/5 ${current === id ? "bg-white/5 ring-1" : ""}`}
                style={{ borderColor: "var(--border)" }}
                onClick={() => {
                  onSelect(id);
                  onClose();
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: id === 1 ? "#22c55e" : id === 42161 ? "#818cf8" : "#94a3b8" }} />
                  <span className="text-sm">{CHAIN_NAMES[id] || `Chain ${id}`}</span>
                </div>
                <div className="flex items-center gap-2 text-xs opacity-70">
                  <span>{id}</span>
                  {current === id ? <span className="h-4 w-4 inline-flex items-center justify-center rounded-full bg-white/20">✓</span> : null}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 