import { COURSES, SCRAMBLE_ALLOWANCE } from "@/config/tournament";
import { loadRawScores, buildScoringContext } from "@/lib/data";
import { deriveMatchState } from "@/lib/scoring/derive";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { AnyMatch, MatchState, ScoringMode } from "@/lib/types";
import clsx from "clsx";

export const dynamic = "force-dynamic";

const isMode = (v: unknown): v is ScoringMode => v === "NET" || v === "GROSS";

function names(match: AnyMatch, side: "EU" | "USA", playerName: (id: string) => string) {
  if (match.format === "DAY3_SINGLES") {
    return [playerName(side === "EU" ? match.euPlayer : match.usaPlayer)];
  }
  const ids = side === "EU" ? match.euPlayers : match.usaPlayers;
  return ids.map(playerName);
}

function ScorecardTable({ match, state }: { match: AnyMatch; state: MatchState }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-ink/5 text-ink/60 text-[11px] uppercase tracking-widest">
          <tr>
            <th className="px-2 py-2 text-left">Hole</th>
            <th className="px-2 py-2 text-right">Par</th>
            <th className="px-2 py-2 text-right">SI</th>
            <th className="px-2 py-2 text-right">EU</th>
            <th className="px-2 py-2 text-right">USA</th>
            <th className="px-2 py-2 text-right">Result</th>
          </tr>
        </thead>
        <tbody>
          {state.holeResults.map((hr) => (
            <tr key={hr.hole.number} className="border-t border-ink/5">
              <td className="px-2 py-2 tabular-nums">{hr.hole.number}</td>
              <td className="px-2 py-2 text-right tabular-nums">{hr.hole.par}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink/60">{hr.hole.strokeIndex}</td>
              <td className={clsx("px-2 py-2 text-right tabular-nums", hr.winner === "EU" && "font-semibold text-eu")}>
                {hr.euScore ?? "—"}
              </td>
              <td className={clsx("px-2 py-2 text-right tabular-nums", hr.winner === "USA" && "font-semibold text-usa")}>
                {hr.usaScore ?? "—"}
              </td>
              <td className={clsx(
                "px-2 py-2 text-right eyebrow",
                hr.winner === "EU" && "team-eu",
                hr.winner === "USA" && "team-usa",
              )}>
                {hr.winner === "PENDING" ? "" :
                 hr.winner === "HALVED" ? "½" :
                 hr.winner === "EU" ? "EU" : "USA"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function MatchDetailPage({
  params, searchParams,
}: { params: { id: string }; searchParams: { mode?: string } }) {
  const { individualScores, scrambleScores } = await loadRawScores();
  const ctx = await buildScoringContext(individualScores, scrambleScores);
  const match = ctx.matches.find((m) => m.id === params.id);
  if (!match) return notFound();
  const course = COURSES.find((c) => c.id === match.courseId)!;
  const mode = isMode(searchParams.mode) ? searchParams.mode : "NET";
  const playerName = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? id;

  const state = deriveMatchState({
    match, course, players: ctx.players,
    individualScores, scrambleScores, mode,
    tee: (playerId: string) => ctx.getTeeForMatch(match, playerId),
    scrambleAllowance: SCRAMBLE_ALLOWANCE,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Day {match.dayNumber} · Match {match.matchNumber} · {course.name}</p>
        <div className="flex gap-1 text-xs">
          {(["NET", "GROSS"] as ScoringMode[]).map((m) => (
            <Link key={m}
              href={`/matches/${match.id}?mode=${m}`}
              className={clsx(
                "px-2.5 py-1 rounded-full uppercase tracking-widest",
                mode === m ? "bg-ink text-cream" : "border border-ink/15 text-ink/60",
              )}
            >{m}</Link>
          ))}
        </div>
      </div>

      <section className="card p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div>
            <p className="badge-eu mb-1">EUROPE</p>
            {names(match, "EU", playerName).map((n) => <p key={n} className="font-medium leading-tight">{n}</p>)}
          </div>
          <div className="text-center">
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
          <Link href={`/score/${match.id}`} className="btn">Score this match</Link>
        </div>
      </section>

      <ScorecardTable match={match} state={state} />
    </div>
  );
}

