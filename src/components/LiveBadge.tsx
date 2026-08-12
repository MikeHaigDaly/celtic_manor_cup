"use client";
import { useLiveScores } from "@/hooks/useLiveScores";
import clsx from "clsx";

export function LiveBadge({ className }: { className?: string }) {
  const status = useLiveScores();
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest", className)}>
      <span className={clsx(
        "h-1.5 w-1.5 rounded-full",
        status === "live" ? "bg-emerald-500 animate-pulse" :
        status === "connecting" ? "bg-amber-500" : "bg-red-500",
      )} />
      {status === "live" ? "Live" : status === "connecting" ? "Connecting" : "Offline"}
    </span>
  );
}

