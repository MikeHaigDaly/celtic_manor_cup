import "./globals.css";
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
        <header className="hidden md:block border-b border-ink/10 bg-cream/80 backdrop-blur sticky top-0 z-30">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-end">
            <TopNav />
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

