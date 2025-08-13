import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HL Workbench",
  description: "Hyperliquid RouteLab and tools",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="sticky top-0 z-20 border-b" style={{ backgroundColor: "rgba(11,18,32,0.7)", backdropFilter: "blur(8px)", borderColor: "var(--border)" }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <Link href="/" className="font-semibold">HL Workbench</Link>
            <nav className="flex items-center gap-3 text-sm">
              <Link href="/routes" className="hover:underline">Routes</Link>
            </nav>
          </div>
        </header>
        <main className="min-h-screen">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">{children}</div>
        </main>
        <footer className="border-t py-6 text-center text-xs" style={{ borderColor: "var(--border)", color: "#9fb0c5" }}>
          Built for Hyperliquid Community Hackathon
        </footer>
      </body>
    </html>
  );
}
