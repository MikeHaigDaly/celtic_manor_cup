import Link from "next/link";
import { redirect } from "next/navigation";
import { isScorer } from "@/lib/auth";
import { loadMatches, loadPlayers } from "@/lib/tournamentData";
import { scorerLogoutAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function ScoreIndex() {
  if (!isScorer()) redirect("/score/login?next=/score");

  const [matches, players] = await Promise.all([loadMatches(), loadPlayers()]);
  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="display text-2xl">Score entry</h1>
        <form action={scorerLogoutAction}>
          <button className="btn-outline text-xs">Sign out</button>
        </form>
      </div>

      {[1, 2, 3].map((day) => (
        <section key={day}>
          <h2 className="eyebrow mb-2">Day {day}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {matches.filter((m) => m.dayNumber === day).map((m) => {
              const eu = m.format === "DAY3_SINGLES"
                ? playerName(m.euPlayer)
                : m.euPlayers.map(playerName).join(" / ");
              const usa = m.format === "DAY3_SINGLES"
                ? playerName(m.usaPlayer)
                : m.usaPlayers.map(playerName).join(" / ");
              return (
                <Link key={m.id} href={`/score/${m.id}`} className="card p-4 hover:shadow-md">
                  <p className="eyebrow">Match {m.matchNumber}</p>
                  <p className="mt-1"><span className="team-eu font-medium">{eu}</span> <span className="text-ink/40 mx-1">vs</span> <span className="team-usa font-medium">{usa}</span></p>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

