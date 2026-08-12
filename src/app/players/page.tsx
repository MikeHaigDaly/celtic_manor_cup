import Link from "next/link";
import { loadRawScores, buildScoringContext } from "@/lib/data";
import { calculatePlayerStats } from "@/lib/scoring/playerStats";

export const dynamic = "force-dynamic";

function Avatar({ name, url }: { name: string; url?: string | null }) {
  const initials = name.split(" ").map((s) => s[0]).slice(0, 2).join("");
  if (url) return <img src={url} alt={name} className="h-14 w-14 rounded-full object-cover" />;
  return (
    <div className="h-14 w-14 rounded-full bg-ink/10 flex items-center justify-center display text-lg">
      {initials}
    </div>
  );
}

export default async function PlayersPage() {
  const { individualScores, scrambleScores } = await loadRawScores();
  const ctx = await buildScoringContext(individualScores, scrambleScores);
  const players = ctx.players;
  const stats = new Map(players.map((p) => [p.id, calculatePlayerStats(p.id, ctx)]));

  const team = (code: "EU" | "USA", label: string) => (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="display text-xl">{label}</h2>
        <span className={code === "EU" ? "badge-eu" : "badge-usa"}>{code}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {players.filter((p) => p.team === code).map((p) => {
          const s = stats.get(p.id)!;
          return (
            <Link key={p.id} href={`/players/${p.id}`} className="card p-4 flex items-center gap-4 hover:shadow-md transition">
              <Avatar name={p.name} url={p.photoUrl} />
              <div className="flex-1">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-ink/60">HI {p.handicapIndex.toFixed(1)} · {s.wins}-{s.losses}-{s.halves}</p>
              </div>
              <div className="text-right">
                <p className="eyebrow">Cup pts</p>
                <p className="display text-lg">{s.cupPointsContributed}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="space-y-8">
      {team("EU", "Team Europe")}
      {team("USA", "Team USA")}
    </div>
  );
}

