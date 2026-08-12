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
    const sb = supabaseBrowser();
    const channel = sb
      .channel("cmc-scores")
      .on("postgres_changes", { event: "*", schema: "public", table: "scores" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "scramble_scores" }, () => router.refresh())
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setStatus("live");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") setStatus("offline");
        else setStatus("connecting");
      });
    return () => { sb.removeChannel(channel); };
  }, [router]);

  return status;
}

