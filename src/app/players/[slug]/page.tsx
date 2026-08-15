import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { COURSES, SCRAMBLE_ALLOWANCE } from "@/config/tournament";
import { buildScoringContext } from "@/lib/data";
import { deriveMatchState, individualMatchHandicaps } from "@/lib/scoring/derive";
import { getHandicapStrokes } from "@/lib/scoring/handicap";
import { scoreMarkKind } from "@/lib/scoring/scoreMark";
import { ScoreMark } from "@/components/ScoreMark";
import type { AnyMatch } from "@/lib/types";

// Cached; invalidated by revalidatePath() in the score/setup server actions.

const fmt = (n: number | null) =>
  n == null ? "—" : n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`;

function matchForPlayerOnDay(matches: AnyMatch[], playerId: string, day: 1 | 3): AnyMatch | undefined {
  return matches.find((m) => {
    if (m.format === "DAY3_SINGLES") return day === 3 && (m.euPlayer === playerId || m.usaPlayer === playerId);
    if (m.format === "DAY1_PAR_PAIRS") return day === 1 && (m.euPlayers.includes(playerId) || m.usaPlayers.includes(playerId));
    return false;
  });
}

export default async function PlayerScorecard({
  params, searchParams,
}: { params: { slug: string }; searchParams: { day?: string } }) {
  const ctx = await buildScoringContext();
  const player = ctx.players.find((p) => p.id === params.slug);
  if (!player) return notFound();

  const day1Match = matchForPlayerOnDay(ctx.matches, player.id, 1);
  const day3Match = matchForPlayerOnDay(ctx.matches, player.id, 3);

  const requestedDay = searchParams.day === "3" ? 3 : searchParams.day === "1" ? 1 : null;
  const day: 1 | 3 | null =
    requestedDay === 1 && day1Match ? 1 :
    requestedDay === 3 && day3Match ? 3 :
    day1Match ? 1 :
    day3Match ? 3 : null;

  const match = day === 1 ? day1Match : day === 3 ? day3Match : undefined;

  const header = (
    <section className="card p-5 flex items-center gap-4">
      <div className="h-16 w-16 rounded-full bg-ink/10 flex items-center justify-center display text-lg shrink-0">
        {player.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
      </div>
      <div className="flex-1 min-w-0">
        <p className="eyebrow">{player.team === "EU" ? "Team Europe" : player.team === "USA" ? "Team USA" : "Unassigned"}</p>
        <h1 className="display text-2xl mt-1">{player.name}</h1>
        <p className="text-sm text-ink/60">Handicap Index {player.handicapIndex.toFixed(1)}</p>
      </div>
    </section>
  );

  if (!match) {
    return (
      <div className="space-y-6">
        {header}
        <section className="card p-5 text-center text-sm text-ink/60">
          No match assigned yet — check back once pairings are set.
        </section>
      </div>
    );
  }

  const course = COURSES.find((c) => c.id === match.courseId)!;
  const playerName = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? id;
  const signed = ctx.signedMatches.has(match.id);
  const lockedHoles = ctx.lockedHolesByMatch.get(match.id) ?? new Set<number>();

  const state = deriveMatchState({
    match, course, players: ctx.players,
    individualScores: ctx.individualScores, scrambleScores: ctx.scrambleScores, mode: "NET",
    tee: (playerId: string) => ctx.getTeeForMatch(match, playerId),
    scrambleAllowance: SCRAMBLE_ALLOWANCE,
    lockedHoles,
  });

  const side: "EU" | "USA" =
    match.format === "DAY3_SINGLES"
      ? (match.euPlayer === player.id ? "EU" : "USA")
      : (match.euPlayers.includes(player.id) ? "EU" : "USA");

  const opponents = match.format === "DAY3_SINGLES"
    ? [playerName(side === "EU" ? match.usaPlayer : match.euPlayer)]
    : (side === "EU" ? match.usaPlayers : match.euPlayers).map(playerName);

  const partner = match.format === "DAY1_PAR_PAIRS"
    ? (side === "EU" ? match.euPlayers : match.usaPlayers).find((id) => id !== player.id)
    : null;

  const strokesMap = individualMatchHandicaps(match, ctx.players, (playerId: string) => ctx.getTeeForMatch(match, playerId));
  const matchStrokes = strokesMap.get(player.id)?.matchStrokes ?? 0;

  const holes = [...course.holes].sort((a, b) => a.number - b.number);
  const individualScoreFor = (holeNumber: number) =>
    ctx.individualScores.find(
      (s) => s.matchId === match.id && s.playerId === player.id && s.holeNumber === holeNumber,
    )?.gross ?? null;

  let grossTotal = 0, grossHoles = 0, parTotal = 0;

  const rows = holes.map((hole) => {
    const gross = individualScoreFor(hole.number);
    const strokes = getHandicapStrokes(matchStrokes, hole.strokeIndex);
    const net = gross == null ? null : gross - strokes;
    if (gross != null) {
      grossTotal += gross;
      parTotal += hole.par;
      grossHoles += 1;
    }
    const hr = state.holeResults.find((r) => r.hole.number === hole.number)!;
    const locked = lockedHoles.has(hole.number);
    return { hole, gross, net, winner: hr.winner, locked };
  });

  const toPar = grossHoles > 0 ? grossTotal - parTotal : null;

  return (
    <div className="space-y-6">
      {header}

      {day1Match && day3Match && (
        <div className="flex gap-2">
          <Link
            href={`/players/${player.id}?day=1`}
            className={clsx("card px-4 py-2 text-sm flex-1 text-center", day === 1 ? "font-semibold" : "text-ink/60")}
          >
            Day 1
          </Link>
          <Link
            href={`/players/${player.id}?day=3`}
            className={clsx("card px-4 py-2 text-sm flex-1 text-center", day === 3 ? "font-semibold" : "text-ink/60")}
          >
            Day 3
          </Link>
        </div>
      )}

      <section className="card p-5">
        <p className="eyebrow text-center">
          Day {match.dayNumber} · Match {match.matchNumber} · {course.name.replace("Celtic Manor — ", "")}
        </p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mt-3">
          <div className={side === "USA" ? "text-right" : ""}>
            <p className={side === "EU" ? "badge-eu mb-1" : "badge-usa mb-1"}>{side === "EU" ? "EUROPE" : "USA"}</p>
            <p className="font-medium leading-tight">{player.name}{partner ? ` / ${playerName(partner)}` : ""}</p>
          </div>
          <div className="text-center">
            {signed && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 mb-1 text-[11px] font-semibold uppercase tracking-widest bg-ink/10 text-ink/60">
                Signed
              </span>
            )}
            <p className={clsx(
              "display text-xl",
              state.leadTeam === "EU" && "team-eu",
              state.leadTeam === "USA" && "team-usa",
            )}>
              {state.statusText}
            </p>
            {!state.finished && state.holesCompleted > 0 && <p className="eyebrow mt-1">THRU {state.throughHole}</p>}
            {state.finished && <p className="eyebrow mt-1">Final</p>}
          </div>
          <div className={side === "EU" ? "text-right" : ""}>
            <p className={side === "EU" ? "badge-usa mb-1" : "badge-eu mb-1"}>{side === "EU" ? "USA" : "EUROPE"}</p>
            {opponents.map((n) => <p key={n} className="font-medium leading-tight">{n}</p>)}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <p className="eyebrow">Thru</p>
          <p className="display text-lg mt-1">{grossHoles}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="eyebrow">Gross</p>
          <p className="display text-lg mt-1">{grossHoles > 0 ? grossTotal : "—"}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="eyebrow">Gross to par</p>
          <p className="display text-lg mt-1">{fmt(toPar)}</p>
        </div>
      </section>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ink/5 text-ink/60 text-[11px] uppercase tracking-widest">
            <tr>
              <th className="px-2 py-2 text-left">Hole</th>
              <th className="px-2 py-2 text-right">Par</th>
              <th className="px-2 py-2 text-right">SI</th>
              <th className="px-2 py-2 text-right">Gross</th>
              <th className="px-2 py-2 text-right">Net</th>
              <th className="px-2 py-2 text-right">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.hole.number} className="border-t border-ink/5">
                <td className="px-2 py-2 tabular-nums">{r.hole.number}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.hole.par}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink/60">{r.hole.strokeIndex}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  <ScoreMark kind={scoreMarkKind(r.gross, r.hole.par)}>{r.gross ?? "—"}</ScoreMark>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-ink/60">{r.net ?? "—"}</td>
                <td className={clsx(
                  "px-2 py-2 text-right eyebrow",
                  r.locked && r.winner === "EU" && "team-eu",
                  r.locked && r.winner === "USA" && "team-usa",
                )}>
                  {!r.locked || r.winner === "PENDING" ? "" : r.winner === "HALVED" ? "½" : r.winner}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-center">
        <Link href={`/matches/${match.id}`} className="text-sm text-ink/60 hover:underline">
          View full match →
        </Link>
      </div>
    </div>
  );
}
