'use client';

import { useMemo, useState } from 'react';
import type { CompareRoutesResponse, NormalizedRouteQuote, RouteHop } from '../../lib/types/routing';

const presets = [
  { label: 'USDC -> USDT (stable)', chainId: 1, tokenIn: 'USDC', tokenOut: 'USDT', amountIn: '1000', slippageBps: 50 },
  { label: 'ETH -> USDC (volatile->stable)', chainId: 1, tokenIn: 'ETH', tokenOut: 'USDC', amountIn: '1', slippageBps: 100 },
  { label: 'ARB -> ETH (multi-hop)', chainId: 42161, tokenIn: 'ARB', tokenOut: 'ETH', amountIn: '500', slippageBps: 100 },
];

export default function RoutesPage() {
  const [chainId, setChainId] = useState<number>(presets[0].chainId);
  const [tokenIn, setTokenIn] = useState<string>(presets[0].tokenIn);
  const [tokenOut, setTokenOut] = useState<string>(presets[0].tokenOut);
  const [amountIn, setAmountIn] = useState<string>(presets[0].amountIn);
  const [slippageBps, setSlippageBps] = useState<number>(presets[0].slippageBps);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareRoutesResponse | null>(null);

  const canSubmit = useMemo(() => {
    return tokenIn.trim().length > 0 && tokenOut.trim().length > 0 && amountIn.trim().length > 0;
  }, [tokenIn, tokenOut, amountIn]);

  const applyPreset = (idx: number) => {
    const p = presets[idx];
    setChainId(p.chainId);
    setTokenIn(p.tokenIn);
    setTokenOut(p.tokenOut);
    setAmountIn(p.amountIn);
    setSlippageBps(p.slippageBps);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/routes/compare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chainId, tokenIn, tokenOut, amountIn, slippageBps }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as CompareRoutesResponse;
      setResult(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">RouteLab — GlueX vs LI.FI</h1>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500">Presets:</span>
        {presets.map((p, i) => (
          <button
            key={i}
            onClick={() => applyPreset(i)}
            className="text-sm px-3 py-1 rounded border hover:bg-gray-50"
            type="button"
          >
            {p.label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Chain ID</span>
          <input
            type="number"
            value={chainId}
            onChange={(e) => setChainId(Number(e.target.value))}
            className="border rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Token In (symbol or address)</span>
          <input
            value={tokenIn}
            onChange={(e) => setTokenIn(e.target.value)}
            className="border rounded px-3 py-2"
            placeholder="USDC"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Token Out (symbol or address)</span>
          <input
            value={tokenOut}
            onChange={(e) => setTokenOut(e.target.value)}
            className="border rounded px-3 py-2"
            placeholder="USDT"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Amount In</span>
          <input
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            className="border rounded px-3 py-2"
            placeholder="1000"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Slippage (bps)</span>
          <input
            type="number"
            value={slippageBps}
            onChange={(e) => setSlippageBps(Number(e.target.value))}
            className="border rounded px-3 py-2"
            placeholder="50"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {loading ? 'Comparing…' : 'Compare Routes'}
          </button>
        </div>
      </form>

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}

      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RouteCard title="GlueX" data={result.gluex} />
          <RouteCard title="LI.FI" data={result.lifi} />
        </div>
      )}
    </div>
  );
}

function RouteCard({ title, data }: { title: string; data: NormalizedRouteQuote | undefined }) {
  if (!data) {
    return (
      <div className="border rounded p-4">
        <h2 className="font-medium mb-2">{title}</h2>
        <div className="text-sm text-gray-500">No data</div>
      </div>
    );
  }
  return (
    <div className="border rounded p-4">
      <h2 className="font-medium mb-2">{title}</h2>
      {data.success ? (
        <div className="space-y-1 text-sm">
          <div>
            <span className="text-gray-500">Expected Out:</span> {data.expectedOut}
          </div>
          {data.priceImpactBps !== undefined && (
            <div>
              <span className="text-gray-500">Price Impact:</span> {(data.priceImpactBps / 100).toFixed(2)}%
            </div>
          )}
          {data.gasEstimate && (
            <div>
              <span className="text-gray-500">Gas Est:</span> {data.gasEstimate}
            </div>
          )}
          <div className="mt-2">
            <div className="text-gray-500">Hops:</div>
            <ul className="list-disc list-inside">
              {data.hops?.map((h: RouteHop, i: number) => (
                <li key={i}>
                  {h.tokenIn} → {h.tokenOut} {h.feeBps ? `(${h.feeBps} bps)` : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="text-sm text-red-600">{data.reason || 'Failed to fetch route'}</div>
      )}
    </div>
  );
} 