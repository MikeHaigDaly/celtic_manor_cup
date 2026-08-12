import { scorerLoginAction } from "@/app/actions/auth";

export default function ScoreLoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  return (
    <div className="max-w-sm mx-auto space-y-4">
      <h1 className="display text-2xl">Scorer sign-in</h1>
      <p className="text-sm text-ink/60">Enter the shared scorer PIN to enable score entry on this device.</p>
      <form action={scorerLoginAction} className="space-y-3">
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="PIN"
          className="w-full rounded-lg border border-ink/15 px-4 py-3 text-lg tracking-widest text-center"
          required
        />
        <input type="hidden" name="next" value={searchParams.next ?? "/score"} />
        <button className="btn w-full">Unlock scoring</button>
        {searchParams.error && (
          <p className="text-sm text-red-600 text-center">Incorrect PIN. Try again.</p>
        )}
      </form>
    </div>
  );
}

