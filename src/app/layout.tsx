import "./globals.css";
import Image from "next/image";
import type { Metadata, Viewport } from "next";
import { TOURNAMENT } from "@/config/tournament";
import { BottomNav, TopNav } from "@/components/Nav";
// LiveBadge temporarily disabled — isolating whether its WebSocket
// subscription (mounted globally, so active even on /teams) is behind the
// intermittent "Server Components render" crash. Re-enable once confirmed
// either way.
// import { LiveBadge } from "@/components/LiveBadge";

export const metadata: Metadata = {
  title: `${TOURNAMENT.name} · ${TOURNAMENT.subtitle}`,
  description: `${TOURNAMENT.name} — ${TOURNAMENT.year}`,
};
export const viewport: Viewport = {
  themeColor: "#F7F3EC",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased pb-20 md:pb-0">
        <header className="border-b border-eu-accent/40 bg-cream/80 backdrop-blur sticky top-0 z-30">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="" width={32} height={32} className="rounded-full" priority />
              <span className="display text-lg tracking-tight">{TOURNAMENT.name}</span>
            </div>
            <div className="hidden md:block">
              <TopNav />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6 md:py-10">
          {children}
        </main>

        <BottomNav />
      </body>
    </html>
  );
}

