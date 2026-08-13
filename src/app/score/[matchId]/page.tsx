import { notFound } from "next/navigation";
import { COURSES, SCRAMBLE_ALLOWANCE } from "@/config/tournament";
import { loadRawScores, buildScoringContext } from "@/lib/data";
import { ScoreEntry } from "@/components/ScoreEntry";

export const dynamic = "force-dynamic";

export default async function ScoreMatchPage({
  params, searchParams,
}: { params: { matchId: string }; searchParams: { hole?: string } }) {
  const { individualScores, scrambleScores } = await loadRawScores();
  const ctx = await buildScoringContext(individualScores, scrambleScores);
  const match = ctx.matches.find((m) => m.id === params.matchId);
  if (!match) return notFound();
  const lockedHoles = [...(ctx.lockedHolesByMatch.get(match.id) ?? [])];
  const signed = ctx.signedMatches.has(match.id);
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
      individualScores={individualScores.filter((s) => s.matchId === match.id)}
      scrambleScores={scrambleScores.filter((s) => s.matchId === match.id)}
      initialLockedHoles={lockedHoles}
      initialSigned={signed}
      initialHoleNumber={initialHoleNumber}
    />
  );
}

