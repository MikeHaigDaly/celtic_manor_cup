import { redirect } from "next/navigation";
import { isTeamsEditor } from "@/lib/auth";
import { teamsLogoutAction } from "@/app/actions/auth";
import {
  loadTournamentMeta, loadPlayers, loadRoundSettings, loadMatches, loadPlayerTeeSelections,
} from "@/lib/tournamentData";
import { TeamBoard } from "@/components/TeamBoard";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  if (!isTeamsEditor()) redirect("/teams/login?next=/teams");

  const [meta, players, roundSettings, matches, teeSelections] = await Promise.all([
    loadTournamentMeta(),
    loadPlayers(),
    loadRoundSettings(),
    loadMatches(),
    loadPlayerTeeSelections(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display text-2xl">Teams &amp; Setup</h1>
          <p className="text-sm text-ink/70 mt-1">
            Drag golfers between EUROPE and USA, set handicaps, pick each day&apos;s tee, and
            arrange pairings.
          </p>
        </div>
        <form action={teamsLogoutAction}>
          <button className="btn-outline text-xs">Sign out</button>
        </form>
      </div>
      <TeamBoard
        initialPlayers={players}
        initialRoundSettings={roundSettings}
        initialMatches={matches}
        initialTeamsLocked={meta.teamsLocked}
        initialTeeSelections={teeSelections}
      />
    </div>
  );
}
