"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMatchSigned } from "@/app/actions/scores";

export function SignScorecardButton({
  matchSlug, initialSigned, canSign,
}: { matchSlug: string; initialSigned: boolean; canSign: boolean }) {
  const router = useRouter();
  const [signed, setSigned] = useState(initialSigned);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !signed;
    const prev = signed;
    setError(null);
    setSigned(next);
    startTransition(async () => {
      try {
        await setMatchSigned({ matchSlug, signed: next });
      } catch (e) {
        setSigned(prev);
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={toggle}
        disabled={pending || (!signed && !canSign)}
        className={signed ? "btn-outline" : "btn"}
      >
        {signed ? "Unlock" : "Sign scorecard"}
      </button>
      {!signed && !canSign && (
        <p className="text-xs text-ink/40">Match isn&apos;t decided yet</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
