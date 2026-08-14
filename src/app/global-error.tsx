"use client";
import { useEffect } from "react";

/**
 * Backstop for errors thrown in the root layout itself (shared nav, the
 * live-scores WebSocket badge, etc.) — those sit outside every page's own
 * error.tsx boundary, so without this a crash there shows a blank white
 * screen with no recovery. Must render its own <html>/<body>: this replaces
 * the entire root layout when it fires, so nothing from layout.tsx (styles,
 * nav) can be assumed to still be mounted.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => reset(), 1000);
    return () => clearTimeout(t);
  }, [reset]);

  return (
    <html lang="en">
      <body style={{ background: "#F7F3EC", color: "#0E1A1A", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 320, margin: "3rem auto", textAlign: "center", padding: "1.5rem" }}>
          <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>That didn't load — retrying automatically.</p>
          <button
            onClick={() => reset()}
            style={{
              border: "1px solid rgba(14,26,26,0.2)", borderRadius: 8, padding: "8px 16px",
              fontSize: 12, background: "transparent", color: "#0E1A1A",
            }}
          >
            Tap to retry now
          </button>
        </div>
      </body>
    </html>
  );
}
