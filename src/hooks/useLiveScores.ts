"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

export type LiveStatus = "connecting" | "live" | "offline";

/**
 * Subscribes to changes on the `scores` and `scramble_scores` tables and
 * triggers a router.refresh() so RSC re-runs and pulls fresh derived state.
 * Returns the current connection status for a subtle LIVE indicator.
 */
export function useLiveScores(): LiveStatus {
  const router = useRouter();
  const [status, setStatus] = useState<LiveStatus>("connecting");

  useEffect(() => {
    // Purely cosmetic (a "Live" dot) — any failure here must never take
    // down the rest of the app, so every step is defensive.
    let channel: ReturnType<ReturnType<typeof supabaseBrowser>["channel"]> | null = null;
    let sb: ReturnType<typeof supabaseBrowser> | null = null;
    try {
      sb = supabaseBrowser();
      const safeRefresh = () => { try { router.refresh(); } catch { /* ignore */ } };
      channel = sb
        .channel("cmc-scores")
        .on("postgres_changes", { event: "*", schema: "public", table: "scores" }, safeRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "scramble_scores" }, safeRefresh)
        .subscribe((s) => {
          try {
            if (s === "SUBSCRIBED") setStatus("live");
            else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") setStatus("offline");
            else setStatus("connecting");
          } catch { /* ignore */ }
        });
    } catch {
      setStatus("offline");
    }
    return () => {
      try { if (sb && channel) sb.removeChannel(channel); } catch { /* ignore */ }
    };
  }, [router]);

  return status;
}

