export async function GET() {
    const lifiConfigured = Boolean(process.env.LIFI_BASE_URL);
    const gluexConfigured = Boolean(process.env.GLUEX_BASE_URL && process.env.GLUEX_API_KEY);
    return Response.json({ lifiConfigured, gluexConfigured });
} 