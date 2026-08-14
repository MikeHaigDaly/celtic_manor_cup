import { COURSES, SCRAMBLE_ALLOWANCE } from "@/config/tournament";
import { buildScoringContext } from "@/lib/data";
import { deriveMatchState } from "@/lib/scoring/derive";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { AnyMatch, MatchState } from "@/lib/types";
import { SignScorecardButton } from "@/components/SignScorecardButton";
import clsx from "clsx";

// Cached; invalidated by revalidatePath() in the score/setup server actions.

function names(match: AnyMatch, side: "EU" | "USA", playerName: (id: string) => string) {
  if (match.format === "DAY3_SINGLES") {
    return [playerName(side === "EU" ? match.euPlayer : match.usaPlayer)];
  }
  const ids = side === "EU" ? match.euPlayers : match.usaPlayers;
  return ids.map(playerName);
}

function ScorecardTable({
  matchSlug, state, lockedHoles,
}: { matchSlug: string; state: MatchState; lockedHoles: Set<number> }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-ink/5 text-ink/60 text-[11px] uppercase tracking-widest">
          <tr>
            <th className="px-2 py-2 text-left">Hole</th>
            <th className="px-2 py-2 text-right">Par</th>
            <th className="px-2 py-2 text-right">SI</th>
            <th className="px-2 py-2 text-right">Result</th>
            <th className="px-2 py-2 text-right">Locked</th>
          </tr>
        </thead>
        <tbody>
          {state.holeResults.map((hr) => {
            const locked = lockedHoles.has(hr.hole.number);
            const href = `/score/${matchSlug}?hole=${hr.hole.number}`;
            return (
              <tr key={hr.hole.number} className="border-t border-ink/5 hover:bg-ink/5">
                <td className="p-0"><Link href={href} className="block px-2 py-2 tabular-nums">{hr.hole.number}</Link></td>
                <td className="p-0"><Link href={href} className="block px-2 py-2 text-right tabular-nums">{hr.hole.par}</Link></td>
                <td className="p-0"><Link href={href} className="block px-2 py-2 text-right tabular-nums text-ink/60">{hr.hole.strokeIndex}</Link></td>
                <td className="p-0">
                  <Link href={href} className={clsx(
                    "block px-2 py-2 text-right eyebrow",
                    hr.winner === "EU" && "team-eu",
                    hr.winner === "USA" && "team-usa",
                  )}>
                    {hr.winner === "PENDING" ? "" :
                     hr.winner === "HALVED" ? "½" :
                     hr.winner === "EU" ? "EU" : "USA"}
                  </Link>
                </td>
                <td className="p-0">
                  <Link href={href} className="block px-2 py-2 text-right">
                    {locked ? (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest bg-ink/10 text-ink/60">
                        Locked
                      </span>
                    ) : (
                      <span className="text-xs text-ink/30">Unlocked</span>
                    )}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function MatchDetailPage({ params }: { params: { id: string } }) {
  const ctx = await buildScoringContext();
  const match = ctx.matches.find((m) => m.id === params.id);
  if (!match) return notFound();
  const course = COURSES.find((c) => c.id === match.courseId)!;
  const playerName = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? id;
  const signed = ctx.signedMatches.has(match.id);

  // Team results are always officially NET — no gross view for match play.
  const state = deriveMatchState({
    match, course, players: ctx.players,
    individualScores: ctx.individualScores, scrambleScores: ctx.scrambleScores, mode: "NET",
    tee: (playerId: string) => ctx.getTeeForMatch(match, playerId),
    scrambleAllowance: SCRAMBLE_ALLOWANCE,
    lockedHoles: ctx.lockedHolesByMatch.get(match.id) ?? null,
  });

  return (
    <div className="space-y-6">
      <p className="eyebrow">Day {match.dayNumber} · Match {match.matchNumber} · {course.name}</p>

      <section className="card p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div>
            <p className="badge-eu mb-1">EUROPE</p>
            {names(match, "EU", playerName).map((n) => <p key={n} className="font-medium leading-tight">{n}</p>)}
          </div>
          <div className="text-center">
            {signed && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 mb-1 text-[11px] font-semibold uppercase tracking-widest bg-ink/10 text-ink/60">
                Signed
              </span>
            )}
            <p className={clsx(
              "display text-2xl",
              state.leadTeam === "EU" && "team-eu",
              state.leadTeam === "USA" && "team-usa",
            )}>
              {state.statusText}
            </p>
            {!state.finished && state.holesCompleted > 0 && (
              <p className="eyebrow mt-1">THRU {state.throughHole}</p>
            )}
            {state.finished && <p className="eyebrow mt-1">Final</p>}
          </div>
          <div className="text-right">
            <p className="badge-usa mb-1">USA</p>
            {names(match, "USA", playerName).map((n) => <p key={n} className="font-medium leading-tight">{n}</p>)}
          </div>
        </div>
        <div className="mt-4 flex justify-center">
          <SignScorecardButton matchSlug={match.id} initialSigned={signed} canSign={state.finished} />
        </div>
      </section>

      <ScorecardTable matchSlug={match.id} state={state} lockedHoles={ctx.lockedHolesByMatch.get(match.id) ?? new Set()} />
    </div>
  );
}

