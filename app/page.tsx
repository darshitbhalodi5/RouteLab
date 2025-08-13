import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="card p-8">
        <h1 className="text-3xl font-semibold mb-2">HL Workbench</h1>
        <p className="text-sm text-[#9fb0c5] max-w-2xl">
          Compare routes, analyze quotes, and build faster on Hyperliquid. Start with RouteLab to see GlueX and LI.FI side-by-side, with min-out and best-route insights.
        </p>
        <div className="mt-6">
          <Link href="/routes" className="btn btn-primary px-4 py-2">Open RouteLab</Link>
        </div>
      </section>
    </div>
  );
}
