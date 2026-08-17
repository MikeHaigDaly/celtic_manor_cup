"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import clsx from "clsx";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      aria-label="Refresh"
      disabled={pending}
      className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full border border-ink/15 text-ink/70 hover:bg-ink/5 active:scale-95 transition disabled:opacity-50"
    >
      <svg
        viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={clsx(pending && "animate-spin")}
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}
