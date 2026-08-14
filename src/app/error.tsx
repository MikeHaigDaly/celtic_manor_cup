"use client";
import { useEffect } from "react";

/**
 * Root error boundary. Supabase reads already retry once transparently
 * (see src/lib/retry.ts) for a flaky connection — this catches the rest:
 * a render that still fails shows a friendly retry instead of Next's raw
 * crash screen, and auto-retries once on its own since these are almost
 * always a one-off blip that clears itself.
 */
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => reset(), 1000);
    return () => clearTimeout(t);
  }, [reset]);

  return (
    <div className="card p-6 max-w-sm mx-auto mt-12 text-center space-y-3">
      <p className="eyebrow">Connection hiccup</p>
      <p className="text-sm text-ink/70">That didn't load — retrying automatically.</p>
      <button onClick={() => reset()} className="btn-outline text-xs">Tap to retry now</button>
    </div>
  );
}
