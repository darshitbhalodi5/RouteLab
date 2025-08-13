export interface CompareMetricRecord {
  ts: number;
  gluexSuccess: boolean;
  lifiSuccess: boolean;
  gluexMs?: number;
  lifiMs?: number;
}

const BUFFER_SIZE = 100;
const metricsBuffer: CompareMetricRecord[] = [];

export function recordCompareMetric(input: Omit<CompareMetricRecord, "ts">): void {
  const rec: CompareMetricRecord = { ts: Date.now(), ...input };
  metricsBuffer.unshift(rec);
  if (metricsBuffer.length > BUFFER_SIZE) metricsBuffer.pop();
}

export function getMetricsSummary(limit = 20): {
  sampleSize: number;
  gluex: { avgMs?: number; okCount: number };
  lifi: { avgMs?: number; okCount: number };
} {
  const slice = metricsBuffer.slice(0, Math.max(0, Math.min(limit, metricsBuffer.length)));
  const avg = (vals: Array<number | undefined>): number | undefined => {
    const xs = vals.filter((v): v is number => typeof v === "number");
    if (!xs.length) return undefined;
    return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  };
  const gluexAvg = avg(slice.map((r) => r.gluexMs));
  const lifiAvg = avg(slice.map((r) => r.lifiMs));
  const gluexOk = slice.reduce((acc, r) => acc + (r.gluexSuccess ? 1 : 0), 0);
  const lifiOk = slice.reduce((acc, r) => acc + (r.lifiSuccess ? 1 : 0), 0);
  return {
    sampleSize: slice.length,
    gluex: { avgMs: gluexAvg, okCount: gluexOk },
    lifi: { avgMs: lifiAvg, okCount: lifiOk },
  };
}

export function getRecentMetrics(limit = 10): CompareMetricRecord[] {
  return metricsBuffer.slice(0, Math.max(0, Math.min(limit, metricsBuffer.length)));
} 