import Link from "next/link";
import type { AnyMatch, MatchState } from "@/lib/types";
import clsx from "clsx";

function names(match: AnyMatch, side: "EU" | "USA", playerName: (id: string) => string): string {
  if (match.format === "DAY3_SINGLES") {
    const id = side === "EU" ? match.euPlayer : match.usaPlayer;
    return playerName(id);
  }
  const ids = side === "EU" ? match.euPlayers : match.usaPlayers;
  return ids.map(playerName).join(" / ");
}

function formatLabel(m: AnyMatch): string {
  return m.format === "DAY1_PAR_PAIRS" ? "Best/Worst/Both"
       : m.format === "DAY2_SCRAMBLE" ? "Scramble"
       : "Singles";
}

export function MatchCard({
  match, state, playerName,
}: { match: AnyMatch; state: MatchState; playerName: (id: string) => string }) {
  const status = state.statusText;
  const finished = state.finished;
  const notStarted = state.status === "NOT_STARTED";
  const thru = state.holesCompleted > 0 && !finished ? `THRU ${state.throughHole}` : "";

  return (
    <Link
      href={`/matches/${match.id}`}
      className="card block p-4 hover:shadow-md transition"
    >
      <div className="flex items-center justify-between eyebrow">
        <span>Day {match.dayNumber} · Match {match.matchNumber}</span>
        <span>{formatLabel(match)}</span>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div>
          <p className="badge-eu mb-1">EUROPE</p>
          <p className="font-medium leading-tight">{names(match, "EU", playerName)}</p>
        </div>
        <div className={clsx(
          "text-center min-w-[6.5rem]",
          finished ? "text-ink" : "text-ink/80",
        )}>
          <p className={clsx(
            "display text-lg md:text-xl",
            notStarted && "text-ink/40",
            state.leadTeam === "EU" && "team-eu",
            state.leadTeam === "USA" && "team-usa",
          )}>
            {notStarted ? "NOT STARTED" : status}
          </p>
          {thru && <p className="eyebrow mt-0.5">{thru}</p>}
          {finished && <p className="eyebrow mt-0.5">Final</p>}
        </div>
        <div className="text-right">
          <p className="badge-usa mb-1">USA</p>
          <p className="font-medium leading-tight">{names(match, "USA", playerName)}</p>
        </div>
      </div>
    </Link>
  );
}

