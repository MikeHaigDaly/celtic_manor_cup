import {
  loadTournamentMeta, loadPlayers, loadRoundSettings, loadMatches, loadPlayerTeeSelections,
} from "@/lib/tournamentData";
import { TeamBoard } from "@/components/TeamBoard";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const [meta, players, roundSettings, matches, teeSelections] = await Promise.all([
    loadTournamentMeta(),
    loadPlayers(),
    loadRoundSettings(),
    loadMatches(),
    loadPlayerTeeSelections(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-2xl">Teams &amp; Setup</h1>
        <p className="text-sm text-ink/70 mt-1">
          Drag golfers between EUROPE and USA, set handicaps, pick each day&apos;s tee, and
          arrange pairings. Open to anyone at the trip — no PIN required.
        </p>
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
