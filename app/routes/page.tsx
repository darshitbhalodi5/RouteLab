'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BuildRouteRequest, CompareRoutesResponse, NormalizedRouteQuote } from "@/types/routing";
import { RouteGraph } from "@/components/RouteGraph";
import { isProbablyAddressForChain } from "@/lib/address";
import { ChainSelectorModal } from "@/components/ChainSelectorModal";

const presets = [
  { label: 'USDC -> USDT (stable)', chainId: 1, tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', tokenOut: '0xdAC17F958D2ee523a2206206994597C13D831ec7', amountIn: '1000', slippageBps: 50 },
  { label: 'ETH -> USDC (volatile->stable)', chainId: 1, tokenIn: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', tokenOut: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', amountIn: '1', slippageBps: 100 },
  { label: 'ARB -> ETH (multi-hop)', chainId: 42161, tokenIn: '0x912CE59144191C1204E64559FE8253a0e49E6548', tokenOut: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', amountIn: '500', slippageBps: 100 },
];

const defaultUserAddress = (process.env.NEXT_PUBLIC_DEFAULT_USER_ADDRESS || "").trim();

async function fetchWithRetries(url: string, init: RequestInit, retries = 2): Promise<Response> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt <= retries) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      lastErr = new Error(await res.text());
    } catch (e) {
      lastErr = e;
    }
    const backoffMs = Math.min(1500, 200 * Math.pow(2, attempt));
    await new Promise((r) => setTimeout(r, backoffMs));
    attempt++;
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

type HistoryItem = {
  t: number;
  gluexOk: boolean;
  lifiOk: boolean;
  gluexMs?: number;
  lifiMs?: number;
};

const HISTORY_SIZE = 8;

export default function RoutesPage() {
  const [chainId, setChainId] = useState<number>(1);
  const [tokenIn, setTokenIn] = useState<string>(presets[0].tokenIn);
  const [tokenOut, setTokenOut] = useState<string>(presets[0].tokenOut);
  const [amountIn, setAmountIn] = useState<string>(presets[0].amountIn);
  const [slippageBps, setSlippageBps] = useState<number>(presets[0].slippageBps);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareRoutesResponse | null>(null);
  const [tokenMeta, setTokenMeta] = useState<Record<string, { symbol?: string; logoURI?: string }>>({});
  const enableLogos = (process.env.NEXT_PUBLIC_ENABLE_TOKEN_LOGOS || "").toLowerCase() === "true";
  const [chainModalOpen, setChainModalOpen] = useState(false);
  const [tokenInStatus, setTokenInStatus] = useState<{ ok: boolean; msg?: string }>({ ok: true });
  const [tokenOutStatus, setTokenOutStatus] = useState<{ ok: boolean; msg?: string }>({ ok: true });
  const [tokenInInfo, setTokenInInfo] = useState<{ symbol?: string; decimals?: number } | null>(null);
  const [tokenOutInfo, setTokenOutInfo] = useState<{ symbol?: string; decimals?: number } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [status, setStatus] = useState<{ lifiConfigured?: boolean; gluexConfigured?: boolean }>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("routelabForm");
      if (saved) {
        const v = JSON.parse(saved);
        if (typeof v.chainId === "number") setChainId(v.chainId);
        if (typeof v.tokenIn === "string") setTokenIn(v.tokenIn);
        if (typeof v.tokenOut === "string") setTokenOut(v.tokenOut);
        if (typeof v.amountIn === "string") setAmountIn(v.amountIn);
        if (typeof v.slippageBps === "number") setSlippageBps(v.slippageBps);
      }
    } catch { }
  }, []);
  useEffect(() => {
    const v = { chainId, tokenIn, tokenOut, amountIn, slippageBps };
    try { localStorage.setItem("routelabForm", JSON.stringify(v)); } catch { }
  }, [chainId, tokenIn, tokenOut, amountIn, slippageBps]);

  useEffect(() => {
    let mounted = true;
    if (!enableLogos) { setTokenMeta({}); return; }
    fetch(`/api/tokens/meta?chainId=${chainId}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((j) => { if (mounted) setTokenMeta(j.meta || {}); })
      .catch(() => { if (mounted) setTokenMeta({}); });
    return () => { mounted = false; };
  }, [chainId, enableLogos]);

  useEffect(() => {
    let mounted = true;
    fetch('/api/status').then(r => r.ok ? r.json() : Promise.reject()).then((s) => { if (mounted) setStatus(s || {}); }).catch(() => { if (mounted) setStatus({}); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let abort = false;
    const handle = setTimeout(async () => {
      try {
        if (!tokenIn.trim()) { setTokenInStatus({ ok: true }); setTokenInInfo(null); return; }
        if (chainId === 999) { setTokenInStatus({ ok: true }); setTokenInInfo(null); return; }
        if (!isProbablyAddressForChain(chainId, tokenIn.trim()) && tokenIn.trim().toUpperCase() !== "ETH") {
          setTokenInStatus({ ok: false, msg: "Invalid token address for selected chain" });
          setTokenInInfo(null);
          return;
        }
        const res = await fetch("/api/tokens/validate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chainId, address: tokenIn.trim() }) });
        const json = await res.json();
        if (!abort) {
          setTokenInStatus(json.ok ? { ok: true } : { ok: false, msg: json.reason });
          setTokenInInfo(json.ok ? { symbol: json.symbol, decimals: json.decimals } : null);
        }
      } catch {
        if (!abort) { setTokenInStatus({ ok: false, msg: "Validation failed" }); setTokenInInfo(null); }
      }
    }, 300);
    return () => { abort = true; clearTimeout(handle); };
  }, [chainId, tokenIn]);

  useEffect(() => {
    let abort = false;
    const handle = setTimeout(async () => {
      try {
        if (!tokenOut.trim()) { setTokenOutStatus({ ok: true }); setTokenOutInfo(null); return; }
        if (chainId === 999) { setTokenOutStatus({ ok: true }); setTokenOutInfo(null); return; }
        if (!isProbablyAddressForChain(chainId, tokenOut.trim()) && tokenOut.trim().toUpperCase() !== "ETH") {
          setTokenOutStatus({ ok: false, msg: "Invalid token address for selected chain" });
          setTokenOutInfo(null);
          return;
        }
        const res = await fetch("/api/tokens/validate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chainId, address: tokenOut.trim() }) });
        const json = await res.json();
        if (!abort) {
          setTokenOutStatus(json.ok ? { ok: true } : { ok: false, msg: json.reason });
          setTokenOutInfo(json.ok ? { symbol: json.symbol, decimals: json.decimals } : null);
        }
      } catch {
        if (!abort) { setTokenOutStatus({ ok: false, msg: "Validation failed" }); setTokenOutInfo(null); }
      }
    }, 300);
    return () => { abort = true; clearTimeout(handle); };
  }, [chainId, tokenOut]);

  const fromAddressValid = true;
  const canSubmit = useMemo(() => {
    return (
      tokenIn.trim().length > 0 &&
      tokenOut.trim().length > 0 &&
      amountIn.trim().length > 0 &&
      fromAddressValid &&
      tokenInStatus.ok &&
      tokenOutStatus.ok
    );
  }, [tokenIn, tokenOut, amountIn, fromAddressValid, tokenInStatus.ok, tokenOutStatus.ok]);

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
      const base: BuildRouteRequest = { chainId, tokenIn, tokenOut, amountIn, slippageBps };
      const body: BuildRouteRequest = {
        ...base,
        ...(defaultUserAddress ? { fromAddress: defaultUserAddress, toAddress: defaultUserAddress } : {}),
      };
      const res = await fetchWithRetries("/api/routes/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as CompareRoutesResponse;
      setResult(json);
      setHistory((prev) => {
        const item: HistoryItem = {
          t: Date.now(),
          gluexOk: Boolean(json.gluex?.success),
          lifiOk: Boolean(json.lifi?.success),
          gluexMs: json.metrics?.gluexMs,
          lifiMs: json.metrics?.lifiMs,
        };
        const next = [item, ...prev].slice(0, HISTORY_SIZE);
        return next;
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const parsed = useMemo(() => {
    if (!result) return null;
    const glue = result.gluex?.success ? parseFloat(result.gluex.expectedOut) : 0;
    const lif = result.lifi?.success ? parseFloat(result.lifi.expectedOut) : 0;
    const bestProvider = glue >= lif ? "gluex" : "lifi";
    const bestValue = Math.max(glue, lif);
    const otherValue = Math.min(glue, lif);
    const delta = bestValue - otherValue;
    const bps = otherValue > 0 ? (delta / otherValue) * 10000 : 0;
    const minOutGlue = glue > 0 ? glue * (1 - slippageBps / 10000) : 0;
    const minOutLifi = lif > 0 ? lif * (1 - slippageBps / 10000) : 0;
    return { glue, lif, bestProvider, bestValue, otherValue, delta, bps, minOutGlue, minOutLifi };
  }, [result, slippageBps]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">RouteLab</h1>
          <p className="text-sm text-[#9fb0c5]">Compare GlueX vs LI.FI routes</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-[#9fb0c5]">Presets:</span>
          {presets.map((p, i) => (
            <button
              key={i}
              onClick={() => applyPreset(i)}
              className="text-sm px-3 py-1 rounded border hover:bg-white/5"
              type="button"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <MetricsStrip history={history} status={status} />

      <form onSubmit={onSubmit} className="card grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Chain</span>
          <button type="button" className="input flex items-center justify-between" onClick={() => setChainModalOpen(true)}>
            <span>{chainId}</span>
            <span className="text-xs opacity-70">Select</span>
          </button>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Token In (address; ETH symbol allowed)</span>
          <input value={tokenIn} onChange={(e) => setTokenIn(e.target.value)} className={`input ${!tokenInStatus.ok ? "border-red-500" : ""}`} placeholder="0x... or ETH" />
          {!tokenInStatus.ok && <span className="text-xs text-red-600">{tokenInStatus.msg}</span>}
          {tokenInStatus.ok && tokenInInfo && (
            <span className="text-xs text-[#9fb0c5]">{tokenInInfo.symbol ? `${tokenInInfo.symbol.toUpperCase()} · ` : ""}{typeof tokenInInfo.decimals === 'number' ? `${tokenInInfo.decimals} decimals` : ""}</span>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Token Out (address; ETH symbol allowed)</span>
          <input value={tokenOut} onChange={(e) => setTokenOut(e.target.value)} className={`input ${!tokenOutStatus.ok ? "border-red-500" : ""}`} placeholder="0x... or ETH" />
        	{!tokenOutStatus.ok && <span className="text-xs text-red-600">{tokenOutStatus.msg}</span>}
          {tokenOutStatus.ok && tokenOutInfo && (
            <span className="text-xs text-[#9fb0c5]">{tokenOutInfo.symbol ? `${tokenOutInfo.symbol.toUpperCase()} · ` : ""}{typeof tokenOutInfo.decimals === 'number' ? `${tokenOutInfo.decimals} decimals` : ""}</span>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Amount In</span>
          <input value={amountIn} onChange={(e) => setAmountIn(e.target.value)} className="input" placeholder="1000" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Slippage (bps)</span>
          <input type="number" value={slippageBps} onChange={(e) => setSlippageBps(Number(e.target.value))} className="input" placeholder="50" />
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={!canSubmit || loading} className="btn btn-primary px-4 py-2">
            {loading ? "Comparing…" : "Compare Routes"}
          </button>
        </div>
      </form>

      {parsed && (
        <div className="card">
          <div className="text-sm">
            <span className="font-medium">Best route:</span> {parsed.bestProvider.toUpperCase()} ·
            <span className="ml-2">Δ {parsed.delta.toFixed(6)} ({parsed.bps.toFixed(1)} bps)</span>
          </div>
        </div>
      )}

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CompareCard title="GlueX" data={result?.gluex} slippageBps={slippageBps} loading={loading} tokenMeta={enableLogos ? tokenMeta : undefined} latencyMs={result?.metrics?.gluexMs} />
        <CompareCard title="LI.FI" data={result?.lifi} slippageBps={slippageBps} loading={loading} tokenMeta={enableLogos ? tokenMeta : undefined} latencyMs={result?.metrics?.lifiMs} />
      </div>

      <ChainSelectorModal
        open={chainModalOpen}
        onClose={() => setChainModalOpen(false)}
        onSelect={(id) => setChainId(id)}
        current={chainId}
      />
    </div>
  );
}

function MetricsStrip({ history, status }: { history: HistoryItem[]; status: { lifiConfigured?: boolean; gluexConfigured?: boolean } }) {
  const avg = (vals: Array<number | undefined>) => {
    const xs = vals.filter((v): v is number => typeof v === 'number');
    if (!xs.length) return undefined;
    return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  };
  const gluexAvg = avg(history.map(h => h.gluexMs));
  const lifiAvg = avg(history.map(h => h.lifiMs));
  const gluexOkCount = history.filter(h => h.gluexOk).length;
  const lifiOkCount = history.filter(h => h.lifiOk).length;
  const total = history.length || HISTORY_SIZE;
  const Dot = ({ ok }: { ok: boolean }) => (
    <span className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
  );
  return (
    <div className="card flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <span className="text-xs px-2 py-1 rounded border" style={{ borderColor: 'var(--border)' }}>Status</span>
        <span className="text-[11px] text-[#9fb0c5] flex items-center gap-2">
          <span className={`px-1.5 py-0.5 rounded border text-[10px] ${status.gluexConfigured ? 'border-green-500/40 text-green-500' : 'border-red-500/40 text-red-500'}`}>GlueX {status.gluexConfigured ? 'OK' : 'MISSING'}</span>
          <span className={`px-1.5 py-0.5 rounded border text-[10px] ${status.lifiConfigured ? 'border-green-500/40 text-green-500' : 'border-red-500/40 text-red-500'}`}>LI.FI {status.lifiConfigured ? 'OK' : 'MISSING'}</span>
        </span>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded border" style={{ borderColor: 'var(--border)' }}>GlueX</span>
          <span className="text-[11px] text-[#9fb0c5]">{typeof gluexAvg === 'number' ? `${gluexAvg} ms avg` : '-'} · {gluexOkCount}/{total} ok</span>
          <span className="flex items-center gap-1">
            {Array.from({ length: Math.min(history.length, HISTORY_SIZE) }).map((_, i) => (
              <Dot key={`g-${i}`} ok={history[i]?.gluexOk ?? false} />
            ))}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded border" style={{ borderColor: 'var(--border)' }}>LI.FI</span>
          <span className="text-[11px] text-[#9fb0c5]">{typeof lifiAvg === 'number' ? `${lifiAvg} ms avg` : '-'} · {lifiOkCount}/{total} ok</span>
          <span className="flex items-center gap-1">
            {Array.from({ length: Math.min(history.length, HISTORY_SIZE) }).map((_, i) => (
              <Dot key={`l-${i}`} ok={history[i]?.lifiOk ?? false} />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

function CompareCard({ title, data, slippageBps, loading, tokenMeta, latencyMs }: { title: string; data: NormalizedRouteQuote | undefined; slippageBps: number; loading: boolean; tokenMeta?: Record<string, { symbol?: string; logoURI?: string }>; latencyMs?: number }) {
  if (loading) return <SkeletonCard title={title} />;
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded border" style={{ borderColor: "var(--border)" }}>{title}</span>
          {typeof latencyMs === 'number' && (
            <span className="text-[10px] text-[#9fb0c5]">{latencyMs} ms</span>
          )}
        </div>
        <CopyJsonButton payload={data?.raw ?? data} />
      </div>
      {data?.success ? (
        <div className="space-y-3">
          <div className="flex items-end gap-4">
            <div>
              <div className="text-xs text-[#9fb0c5]">Expected Out</div>
              <div className="text-2xl font-semibold">{(() => { const n = Number(data.expectedOut || "0"); return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 3 }) : data.expectedOut; })()}</div>
            </div>
            <div>
              <div className="text-xs text-[#9fb0c5]">Min Out (@{slippageBps} bps)</div>
              <div className="text-lg">{(() => { const n = Math.max(0, parseFloat(data.expectedOut || "0") * (1 - slippageBps / 10000)); return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "0"; })()}</div>
            </div>
          </div>
          {data.priceImpactBps !== undefined && (
            <div className="text-sm"><span className="text-[#9fb0c5]">Price Impact:</span> {(data.priceImpactBps / 100).toFixed(2)}%</div>
          )}
          {data.gasEstimate && (
            <div className="text-sm"><span className="text-[#9fb0c5]">Gas Est:</span> {data.gasEstimate}</div>
          )}
          <div>
            <div className="text-sm text-[#9fb0c5]">Route {tokenMeta && Object.keys(tokenMeta).length ? <span className="text-[10px] opacity-70">(logos)</span> : null}</div>
            <RouteGraph hops={data.hops} tokenMeta={tokenMeta} />
          </div>
        </div>
      ) : (
        data ? (
          <div className="text-sm text-red-500 flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/40 text-[10px]">ERROR</span>
            <span>{data.reason || "Failed to fetch route"}</span>
          </div>
        ) : null
      )}
    </div>
  );
}

function SkeletonCard({ title }: { title: string }) {
  return (
    <div className="card animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded border" style={{ borderColor: "var(--border)" }}>{title}</span>
        </div>
        <div className="h-6 w-24 bg.white/10 rounded" />
      </div>
      <div className="space-y-3">
        <div className="h-7 w-32 bg.white/10 rounded" />
        <div className="h-5 w-40 bg.white/10 rounded" />
        <div className="h-4 w-24 bg.white/10 rounded" />
      </div>
    </div>
  );
}

function CopyJsonButton({ payload }: { payload: unknown }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload ?? {}, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { }
  };
  return (
    <button onClick={onCopy} className="btn btn-outline text-xs px-2 py-1">{copied ? "Copied" : "Copy JSON"}</button>
  );
} 