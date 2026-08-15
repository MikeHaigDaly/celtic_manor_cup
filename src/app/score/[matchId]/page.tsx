import { notFound } from "next/navigation";
import { COURSES, SCRAMBLE_ALLOWANCE } from "@/config/tournament";
import { buildMatchScoringContext } from "@/lib/data";
import { ScoreEntry } from "@/components/ScoreEntry";

export const dynamic = "force-dynamic";

export default async function ScoreMatchPage({
  params, searchParams,
}: { params: { matchId: string }; searchParams: { hole?: string } }) {
  const ctx = await buildMatchScoringContext(params.matchId);
  if (!ctx) return notFound();
  const { match } = ctx;
  const lockedHoles = [...ctx.lockedHoles];
  const course = COURSES.find((c) => c.id === match.courseId)!;
  const participantIds =
    match.format === "DAY3_SINGLES"
      ? [match.euPlayer, match.usaPlayer]
      : [...match.euPlayers, ...match.usaPlayers];
  const teeByPlayer = Object.fromEntries(
    participantIds.map((id) => [id, ctx.getTeeForMatch(match, id)]),
  );
  const requestedHole = Number(searchParams.hole);
  const initialHoleNumber = Number.isInteger(requestedHole) && requestedHole >= 1 && requestedHole <= 18
    ? requestedHole : undefined;

  return (
    <ScoreEntry
      match={match}
      course={course}
      players={ctx.players}
      teeByPlayer={teeByPlayer}
      scrambleAllowance={SCRAMBLE_ALLOWANCE}
      individualScores={ctx.individualScores}
      scrambleScores={ctx.scrambleScores}
      initialLockedHoles={lockedHoles}
      initialSigned={ctx.signed}
      initialHoleNumber={initialHoleNumber}
    />
  );
}

