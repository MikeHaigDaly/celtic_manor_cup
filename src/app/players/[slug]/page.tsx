import Link from "next/link";
import { notFound } from "next/navigation";
import { teeById } from "@/config/tournament";
import { buildScoringContext } from "@/lib/data";
import { calculatePlayerStats } from "@/lib/scoring/playerStats";

// Cached; invalidated by revalidatePath() in the score/setup server actions.

const fmt = (n: number | null) =>
  n == null ? "—" : n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`;

export default async function PlayerProfile({ params }: { params: { slug: string } }) {
  const ctx = await buildScoringContext();
  const player = ctx.players.find((p) => p.id === params.slug);
  if (!player) return notFound();
  const s = calculatePlayerStats(player.id, ctx);
  const playerName = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <section className="card p-5 flex items-center gap-5">
        <div className="h-20 w-20 rounded-full bg-ink/10 flex items-center justify-center display text-xl">
          {player.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </div>
        <div className="flex-1">
          <p className="eyebrow">{player.team === "EU" ? "Team Europe" : player.team === "USA" ? "Team USA" : "Unassigned"}</p>
          <h1 className="display text-2xl mt-1">{player.name}</h1>
          <p className="text-sm text-ink/60">Handicap Index {player.handicapIndex.toFixed(1)}</p>
        </div>
        <div className="text-right">
          <p className="eyebrow">Cup points</p>
          <p className="display text-3xl">{s.cupPointsContributed}</p>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Matches", s.matchesPlayed],
          ["W-L-H", `${s.wins}-${s.losses}-${s.halves}`],
          ["Holes W-L-H", `${s.holesWon}-${s.holesLost}-${s.holesHalved}`],
          ["Ind. Net to par", fmt(s.individualNetToPar)],
          ["Ind. Gross to par", fmt(s.individualGrossToPar)],
          ["Par 3", fmt(s.par3ToPar)],
          ["Par 4", fmt(s.par4ToPar)],
          ["Par 5", fmt(s.par5ToPar)],
        ].map(([k, v]) => (
          <div key={k as string} className="card p-3">
            <p className="eyebrow">{k}</p>
            <p className="display text-lg mt-1">{v}</p>
          </div>
        ))}
      </section>

      {s.courseHandicaps.length > 0 && (
        <section>
          <h2 className="display text-lg mb-2">Course Handicap by round</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {s.courseHandicaps.map((ch) => {
              const tee = teeById(ch.teeId);
              return (
                <div key={ch.day} className="card p-3">
                  <p className="eyebrow">Day {ch.day} · {tee?.name ?? "Tee"}</p>
                  <p className="text-sm mt-1">Course Handicap <span className="display text-lg">{ch.courseHandicap}</span></p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {(s.bestHole || s.worstHole) && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {s.bestHole && (
            <div className="card p-4">
              <p className="eyebrow">Best hole</p>
              <p className="mt-1">Hole {s.bestHole.hole} · {s.bestHole.score} ({fmt(s.bestHole.toPar)})</p>
            </div>
          )}
          {s.worstHole && (
            <div className="card p-4">
              <p className="eyebrow">Worst hole</p>
              <p className="mt-1">Hole {s.worstHole.hole} · {s.worstHole.score} ({fmt(s.worstHole.toPar)})</p>
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="display text-xl mb-3">Match by match</h2>
        <div className="space-y-2">
          {s.perMatch.length === 0 && <p className="text-sm text-ink/60">No completed holes yet.</p>}
          {s.perMatch.map((m) => {
            const match = ctx.matches.find((x) => x.id === m.matchId)!;
            return (
              <Link key={m.matchId} href={`/matches/${m.matchId}`} className="card p-3 flex items-center justify-between hover:shadow-md">
                <div>
                  <p className="eyebrow">Day {m.day} · {match.format === "DAY1_PAR_PAIRS" ? "Pair Match" : match.format === "DAY2_SCRAMBLE" ? "Scramble" : "Singles"}</p>
                  <p className="text-sm">{match.format === "DAY3_SINGLES"
                    ? `${playerName(match.euPlayer)} vs ${playerName(match.usaPlayer)}`
                    : `${match.euPlayers.map(playerName).join(" / ")} vs ${match.usaPlayers.map(playerName).join(" / ")}`}</p>
                </div>
                <p className="display">{m.text}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

