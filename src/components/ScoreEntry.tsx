"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AnyMatch, Course, HoleResult, IndividualScore, Player, ScrambleScore, Tee } from "@/lib/types";
import { deriveMatchState, day2PairHandicaps, individualMatchHandicaps } from "@/lib/scoring/derive";
import { day1RuleLabel } from "@/lib/scoring/day1";
import { getHandicapStrokes } from "@/lib/scoring/handicap";
import { upsertIndividualScore, upsertScrambleScore, deleteIndividualScore, deleteScrambleScore } from "@/app/actions/scores";
import clsx from "clsx";

interface Props {
  match: AnyMatch;
  course: Course;
  players: Player[];
  individualScores: IndividualScore[];
  scrambleScores: ScrambleScore[];
  /** Each participant's own chosen tee, keyed by player id. */
  teeByPlayer: Record<string, Tee>;
  scrambleAllowance: { low: number; high: number };
}

/** Big +/- stepper. Saves immediately on every tap — no separate save step. */
function Stepper({
  value, onChange, min = 1, max = 15,
}: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="stepper-btn" aria-label="decrement">−</button>
      <div className="display text-4xl w-14 text-center tabular-nums">{value}</div>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="stepper-btn" aria-label="increment">+</button>
    </div>
  );
}

/** Row of tappable hole circles — jumps straight to a hole, colored by result. */
function HoleDots({
  holes, holeNumber, holeResults, onSelect,
}: { holes: Course["holes"]; holeNumber: number; holeResults: HoleResult[]; onSelect: (n: number) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
      {holes.map((h) => {
        const hr = holeResults[h.number - 1];
        const isCurrent = h.number === holeNumber;
        return (
          <button
            key={h.number}
            type="button"
            onClick={() => onSelect(h.number)}
            aria-label={`Hole ${h.number}`}
            aria-current={isCurrent}
            className={clsx(
              "flex-shrink-0 h-9 w-9 rounded-full text-xs font-semibold flex items-center justify-center border tabular-nums",
              isCurrent && "bg-ink text-cream border-ink",
              !isCurrent && hr.winner === "EU" && "bg-eu/15 border-eu/40 text-ink",
              !isCurrent && hr.winner === "USA" && "bg-usa/15 border-usa/40 text-ink",
              !isCurrent && hr.winner === "HALVED" && "bg-ink/10 border-ink/25 text-ink",
              !isCurrent && hr.winner === "PENDING" && "border-ink/15 text-ink/50",
            )}
          >
            {h.number}
          </button>
        );
      })}
    </div>
  );
}

export function ScoreEntry({ match, course, players, individualScores, scrambleScores, teeByPlayer, scrambleAllowance }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Local score maps — hydrated from props (server truth), used for optimistic UI.
  const [ind, setInd] = useState<IndividualScore[]>(individualScores);
  const [scr, setScr] = useState<ScrambleScore[]>(scrambleScores);

  const getTee = useMemo(() => (playerId: string) => teeByPlayer[playerId] ?? null, [teeByPlayer]);

  // Hole result / match status shown here is always the official NET result —
  // scores are always entered as gross regardless.
  const state = useMemo(() => deriveMatchState({
    match, course, players, individualScores: ind, scrambleScores: scr, tee: getTee, scrambleAllowance,
  }), [match, course, players, ind, scr, getTee, scrambleAllowance]);

  const [holeNumber, setHoleNumber] = useState<number>(() => {
    const pendingHole = state.holeResults.find((h) => h.winner === "PENDING");
    return pendingHole?.hole.number ?? 1;
  });
  const hole = course.holes.find((h) => h.number === holeNumber)!;

  const findInd = (playerId: string) =>
    ind.find((s) => s.matchId === match.id && s.playerId === playerId && s.holeNumber === holeNumber)?.gross;
  const findScr = (side: "EU" | "USA") =>
    scr.find((s) => s.matchId === match.id && s.side === side && s.holeNumber === holeNumber)?.gross;

  function goto(n: number) {
    setHoleNumber(Math.min(18, Math.max(1, n)));
  }

  function updateIndividual(playerId: string, gross: number) {
    startTransition(async () => {
      // optimistic
      setInd((rows) => {
        const other = rows.filter((r) => !(r.matchId === match.id && r.playerId === playerId && r.holeNumber === holeNumber));
        return [...other, { matchId: match.id, playerId, holeNumber, gross }];
      });
      try {
        await upsertIndividualScore({ matchSlug: match.id, playerSlug: playerId, holeNumber, gross });
      } catch (e) {
        console.error(e);
      }
      router.refresh();
    });
  }

  function updateScramble(side: "EU" | "USA", gross: number) {
    startTransition(async () => {
      setScr((rows) => {
        const other = rows.filter((r) => !(r.matchId === match.id && r.side === side && r.holeNumber === holeNumber));
        return [...other, { matchId: match.id, side, holeNumber, gross }];
      });
      try {
        await upsertScrambleScore({ matchSlug: match.id, side, holeNumber, gross });
      } catch (e) { console.error(e); }
      router.refresh();
    });
  }

  async function resetHole() {
    startTransition(async () => {
      if (match.format === "DAY2_SCRAMBLE") {
        setScr((rows) => rows.filter((r) => !(r.matchId === match.id && r.holeNumber === holeNumber)));
        await deleteScrambleScore({ matchSlug: match.id, side: "EU",  holeNumber });
        await deleteScrambleScore({ matchSlug: match.id, side: "USA", holeNumber });
      } else {
        const ids = match.format === "DAY3_SINGLES"
          ? [match.euPlayer, match.usaPlayer]
          : [...match.euPlayers, ...match.usaPlayers];
        setInd((rows) => rows.filter((r) => !(r.matchId === match.id && r.holeNumber === holeNumber && ids.includes(r.playerId))));
        for (const pid of ids) await deleteIndividualScore({ matchSlug: match.id, playerSlug: pid, holeNumber });
      }
      router.refresh();
    });
  }

  const holeResult = state.holeResults[holeNumber - 1];
  const ruleLabel = match.format === "DAY1_PAR_PAIRS" ? day1RuleLabel(hole.par) : null;

  // Precompute per-player match-relative strokes for individual formats and
  // per-side pair PH + match strokes for scramble — used in the UI.
  const matchStrokeByPlayer = useMemo(
    () => individualMatchHandicaps(match, players, getTee),
    [match, players, getTee],
  );

  const scrambleInfo = useMemo(() => {
    if (match.format !== "DAY2_SCRAMBLE")
      return { euPH: 0, usaPH: 0, euMatch: 0, usaMatch: 0, euOverride: false, usaOverride: false };
    return day2PairHandicaps(match, players, getTee, scrambleAllowance);
  }, [match, players, getTee, scrambleAllowance]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <p className="eyebrow">Day {match.dayNumber} · Match {match.matchNumber}</p>
        <p className="text-sm">{course.name}</p>
      </div>

      {/* Hole selector */}
      <HoleDots holes={course.holes} holeNumber={holeNumber} holeResults={state.holeResults} onSelect={goto} />

      {/* Hole header */}
      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="display text-2xl">Hole {hole.number}</p>
          <p className="text-sm text-ink/60">Par {hole.par} · SI {hole.strokeIndex}</p>
          {ruleLabel && <p className="mt-1 text-xs font-semibold tracking-widest uppercase">{ruleLabel}</p>}
        </div>
        <div className="flex gap-1">
          <button onClick={() => goto(holeNumber - 1)} className="btn-outline text-xs" disabled={holeNumber <= 1}>Prev</button>
          <button onClick={() => goto(holeNumber + 1)} className="btn-outline text-xs" disabled={holeNumber >= 18}>Next</button>
        </div>
      </div>

      {/* Score inputs */}
      {match.format === "DAY2_SCRAMBLE" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(["EU", "USA"] as const).map((side) => {
            const ids = side === "EU" ? match.euPlayers : match.usaPlayers;
            const saved = findScr(side);
            const val = saved ?? hole.par;
            const pairPH = side === "EU" ? scrambleInfo.euPH : scrambleInfo.usaPH;
            const matchPH = side === "EU" ? scrambleInfo.euMatch : scrambleInfo.usaMatch;
            const isOverride = side === "EU" ? scrambleInfo.euOverride : scrambleInfo.usaOverride;
            const strokes = getHandicapStrokes(matchPH, hole.strokeIndex);
            return (
              <div key={side} className="card p-4">
                <p className={side === "EU" ? "badge-eu" : "badge-usa"}>{side === "EU" ? "EUROPE" : "USA"}</p>
                <p className="mt-1 font-medium">{ids.map((i) => players.find((p) => p.id === i)?.name).join(" / ")}</p>
                <p className="text-xs text-ink/60">
                  Pair PH {pairPH}{isOverride ? " (override)" : ""} · Match {matchPH}
                  {strokes > 0 ? ` · +${strokes} this hole` : ""}
                </p>
                <div className="mt-3 flex items-center justify-center">
                  <Stepper value={val} onChange={(v) => updateScramble(side, v)} />
                </div>
                {saved != null && strokes > 0 && (
                  <p className="mt-1 text-xs text-ink/60 text-center">Gross {saved} · Net {saved - strokes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(match.format === "DAY1_PAR_PAIRS" || match.format === "DAY3_SINGLES") && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(["EU", "USA"] as const).map((side) => {
            const ids = match.format === "DAY3_SINGLES"
              ? [side === "EU" ? match.euPlayer : match.usaPlayer]
              : (side === "EU" ? match.euPlayers : match.usaPlayers);
            return (
              <div key={side} className="card p-4">
                <p className={side === "EU" ? "badge-eu" : "badge-usa"}>{side === "EU" ? "EUROPE" : "USA"}</p>
                <div className="mt-3 space-y-4">
                  {ids.map((pid) => {
                    const player = players.find((p) => p.id === pid)!;
                    const saved = findInd(pid);
                    const val = saved ?? hole.par;
                    const info = matchStrokeByPlayer.get(pid);
                    const ch = info?.ch ?? 0;
                    const matchPH = info?.matchStrokes ?? 0;
                    const strokes = getHandicapStrokes(matchPH, hole.strokeIndex);
                    return (
                      <div key={pid} className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{player.name}</p>
                          <p className="text-xs text-ink/60">
                            HI {player.handicapIndex.toFixed(1)} · CH {ch} · Match {matchPH}
                            {strokes > 0 ? ` · +${strokes} this hole` : ""}
                          </p>
                          {saved != null && strokes > 0 && (
                            <p className="text-xs">Gross {saved} · Net {saved - strokes}</p>
                          )}
                        </div>
                        <Stepper value={val} onChange={(v) => updateIndividual(pid, v)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hole result + match state */}
      <div className="card p-4">
        <p className="eyebrow">Hole result</p>
        <div className="mt-1 flex items-center justify-between">
          <div className="text-sm">
            <span className="team-eu font-medium">EU {holeResult.euScore ?? "—"}</span>
            <span className="mx-2 text-ink/30">vs</span>
            <span className="team-usa font-medium">USA {holeResult.usaScore ?? "—"}</span>
          </div>
          <p className="display text-lg">
            {holeResult.winner === "PENDING" ? "WAITING FOR SCORE"
              : holeResult.winner === "HALVED" ? "HALVED"
              : holeResult.winner === "EU" ? "EUROPE WINS HOLE" : "USA WINS HOLE"}
          </p>
        </div>
        <p className="mt-2 text-sm text-ink/70">
          Match: <span className="font-medium">{state.statusText}</span>
          {state.holesCompleted > 0 && !state.finished && <> · THRU {state.throughHole}</>}
        </p>
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-16 md:bottom-4 flex gap-2 justify-between">
        <button onClick={resetHole} className="btn-outline" disabled={pending}>Reset hole</button>
        <button onClick={() => goto(holeNumber + 1)} className="btn flex-1" disabled={pending || holeNumber >= 18}>
          Next hole
        </button>
      </div>
    </div>
  );
}
