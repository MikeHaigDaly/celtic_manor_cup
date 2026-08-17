"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { setPlayerPhoto } from "@/app/actions/playerPhoto";

export function PlayerAvatar({
  playerId, name, photoUrl,
}: { playerId: string; name: string; photoUrl?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("photo", file);
    startTransition(async () => {
      try {
        await setPlayerPhoto(playerId, formData);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("");

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Change photo"
        className="h-16 w-16 rounded-full bg-ink/10 flex items-center justify-center display text-lg overflow-hidden relative active:opacity-80 transition"
      >
        {photoUrl ? (
          <Image src={photoUrl} alt={name} fill sizes="64px" className="object-cover" />
        ) : (
          initials
        )}
        {pending && (
          <span className="absolute inset-0 bg-ink/50 flex items-center justify-center text-cream text-[10px]">…</span>
        )}
      </button>
      <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-ink text-cream flex items-center justify-center text-[10px] border-2 border-cream pointer-events-none">
        ✎
      </span>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
      {error && (
        <p className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[10px] text-usa whitespace-nowrap">
          {error}
        </p>
      )}
    </div>
  );
}
