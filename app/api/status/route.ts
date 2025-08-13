export async function GET() {
	const lifiConfigured = Boolean(process.env.LIFI_BASE_URL);
	const gluexConfigured = Boolean(process.env.GLUEX_BASE_URL && process.env.GLUEX_API_KEY);
	// Lazy import to avoid edge bundling surprises if any
	const { getMetricsSummary, getRecentMetrics } = await import("@/lib/metrics");
	const summary = getMetricsSummary(20);
	const recent = getRecentMetrics(8);
	return Response.json({ lifiConfigured, gluexConfigured, summary, recent });
} 