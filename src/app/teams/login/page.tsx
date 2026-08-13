import { teamsLoginAction } from "@/app/actions/auth";

export default function TeamsLoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  return (
    <div className="max-w-sm mx-auto space-y-4">
      <h1 className="display text-2xl">Teams sign-in</h1>
      <p className="text-sm text-ink/60">Enter the password to edit teams, handicaps, and pairings.</p>
      <form action={teamsLoginAction} className="space-y-3">
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Password"
          className="w-full rounded-lg border border-ink/15 px-4 py-3 text-lg tracking-widest text-center"
          required
        />
        <input type="hidden" name="next" value={searchParams.next ?? "/teams"} />
        <button className="btn w-full">Unlock teams</button>
        {searchParams.error && (
          <p className="text-sm text-red-600 text-center">Incorrect password. Try again.</p>
        )}
      </form>
    </div>
  );
}
