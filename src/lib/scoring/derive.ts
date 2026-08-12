import type {
  AnyMatch,
  Course,
  Hole,
  HoleResult,
  IndividualScore,
  MatchState,
  Player,
  ScoringMode,
  ScrambleAllowance,
  ScrambleScore,
  Tee,
} from "@/lib/types";
import { calculateDay1PairScore } from "./day1";
import { calculateDay2SideNet } from "./day2";
import { calculateDay3PlayerScore } from "./day3";
import { calculateHoleWinner, calculateMatchState } from "./matchState";
import {
  calculateCourseHandicap,
  calculatePlayingHandicap,
  calculateScramblePlayingHandicap,
  matchStrokeAllocation,
} from "./courseHandicap";

interface DeriveInput {
  match: AnyMatch;
  course: Course;
  players: Player[];                  // all players (id lookup)
  individualScores: IndividualScore[]; // Day 1 + Day 3
  scrambleScores: ScrambleScore[];    // Day 2
  mode?: ScoringMode;                 // NET (default) or GROSS
  /** Tee for this match — a single Tee for everyone, or a per-player resolver. */
  tee?: TeeResolver;
  /** Handicap allowance % applied to CH → PH (default 100). */
  allowancePercent?: number;
  /** Configurable scramble allowance for Day 2 (default 35/15). */
  scrambleAllowance?: ScrambleAllowance;
}

const findPlayer = (players: Player[], id: string): Player => {
  const p = players.find((p) => p.id === id);
  if (!p) throw new Error(`Player not found: ${id}`);
  return p;
};

const scoreFor = (
  scores: IndividualScore[],
  matchId: string,
  playerId: string,
  holeNumber: number,
): number | null =>
  scores.find(
    (s) => s.matchId === matchId && s.playerId === playerId && s.holeNumber === holeNumber,
  )?.gross ?? null;

const scrambleFor = (
  scores: ScrambleScore[],
  matchId: string,
  side: "EU" | "USA",
  holeNumber: number,
): number | null =>
  scores.find(
    (s) => s.matchId === matchId && s.side === side && s.holeNumber === holeNumber,
  )?.gross ?? null;

/**
 * Course Handicap for a player on a given tee (or CH = round(HI) if no tee).
 * Kept here so all callers share the same tee-nullable behaviour.
 */
export function courseHandicapFor(player: Player, tee: Tee | null | undefined): number {
  if (!tee) return Math.round(player.handicapIndex);
  return calculateCourseHandicap(player.handicapIndex, tee);
}

/**
 * A tee can be supplied as one shared Tee (or null) for every player in a
 * match, OR as a per-player resolver function — this is what lets each
 * golfer pick their own tee per day without breaking every call site that
 * still passes a single Tee.
 */
export type TeeResolver = Tee | null | ((playerId: string) => Tee | null);

export function resolveTeeFor(tee: TeeResolver | undefined, playerId: string): Tee | null {
  return typeof tee === "function" ? tee(playerId) : (tee ?? null);
}

/**
 * Match-play strokes-received map for the players in a match, using the
 * standard match-play "subtract the lowest Playing Handicap" convention.
 *
 * For Day 1 (2 vs 2) all four players are considered together.
 * For Day 3 singles the two players are considered together.
 */
function computeMatchStrokesForMatch(
  match: AnyMatch,
  players: Player[],
  tee: TeeResolver | undefined,
  allowancePercent: number,
): Map<string, number> {
  const ids: string[] =
    match.format === "DAY3_SINGLES"
      ? [match.euPlayer, match.usaPlayer]
      : [...match.euPlayers, ...match.usaPlayers];
  const playingHandicaps = ids.map((id) => {
    const p = findPlayer(players, id);
    const ch = courseHandicapFor(p, resolveTeeFor(tee, id));
    return calculatePlayingHandicap(ch, allowancePercent);
  });
  const strokes = matchStrokeAllocation(playingHandicaps);
  const out = new Map<string, number>();
  ids.forEach((id, i) => out.set(id, strokes[i]));
  return out;
}

/**
 * Day 2 pair Playing Handicap for a side. Uses the manual override if the
 * match config supplies one; otherwise computes from HIs + tee + allowance.
 */
function day2SidePlayingHandicap(
  side: "EU" | "USA",
  match: Extract<AnyMatch, { format: "DAY2_SCRAMBLE" }>,
  players: Player[],
  tee: TeeResolver | undefined,
  allowance: ScrambleAllowance,
): number {
  const override = side === "EU" ? match.euPairHandicap : match.usaPairHandicap;
  const [aId, bId] = side === "EU" ? match.euPlayers : match.usaPlayers;
  const a = findPlayer(players, aId);
  const b = findPlayer(players, bId);
  const chA = courseHandicapFor(a, resolveTeeFor(tee, aId));
  const chB = courseHandicapFor(b, resolveTeeFor(tee, bId));
  return calculateScramblePlayingHandicap(chA, chB, allowance, override ?? null);
}

/**
 * Given raw scores, derive the full 18-hole HoleResult array + MatchState for
 * a match, in either NET or GROSS mode.
 *
 * Handicap pipeline (NET mode):
 *   Handicap Index → Course Handicap (via selected tee)
 *     → Playing Handicap (via allowance %)
 *     → match-relative strokes received (subtract-lowest)
 *     → per-hole strokes via SI
 *     → net score → hole/match comparison.
 */
export function deriveMatchState({
  match,
  course,
  players,
  individualScores,
  scrambleScores,
  mode = "NET",
  tee = null,
  allowancePercent = 100,
  scrambleAllowance = { low: 0.35, high: 0.15 },
}: DeriveInput): MatchState {
  const holes = [...course.holes].sort((a, b) => a.number - b.number);

  // Precompute match strokes for individual formats
  const matchStrokes =
    match.format === "DAY2_SCRAMBLE"
      ? new Map<string, number>()
      : computeMatchStrokesForMatch(match, players, tee, allowancePercent);

  // Precompute Day 2 pair Playing Handicaps AND their match-relative strokes:
  // the lower pair plays off ZERO, the higher pair receives 100% of the diff.
  let day2EuMatchPH = 0;
  let day2UsaMatchPH = 0;
  if (match.format === "DAY2_SCRAMBLE") {
    const euPH  = day2SidePlayingHandicap("EU",  match, players, tee, scrambleAllowance);
    const usaPH = day2SidePlayingHandicap("USA", match, players, tee, scrambleAllowance);
    const [euRel, usaRel] = matchStrokeAllocation([euPH, usaPH]);
    day2EuMatchPH = euRel;
    day2UsaMatchPH = usaRel;
  }

  const results: HoleResult[] = holes.map((hole): HoleResult => {
    let euScore: number | null = null;
    let usaScore: number | null = null;
    const detail: Record<string, unknown> = {};

    if (match.format === "DAY1_PAR_PAIRS") {
      const [eA, eB] = match.euPlayers;
      const [uA, uB] = match.usaPlayers;
      euScore = calculateDay1PairScore(
        hole,
        { gross: scoreFor(individualScores, match.id, eA, hole.number), handicap: matchStrokes.get(eA) ?? 0 },
        { gross: scoreFor(individualScores, match.id, eB, hole.number), handicap: matchStrokes.get(eB) ?? 0 },
        mode,
      );
      usaScore = calculateDay1PairScore(
        hole,
        { gross: scoreFor(individualScores, match.id, uA, hole.number), handicap: matchStrokes.get(uA) ?? 0 },
        { gross: scoreFor(individualScores, match.id, uB, hole.number), handicap: matchStrokes.get(uB) ?? 0 },
        mode,
      );
    } else if (match.format === "DAY2_SCRAMBLE") {
      euScore = calculateDay2SideNet(
        hole,
        scrambleFor(scrambleScores, match.id, "EU", hole.number),
        day2EuMatchPH,
        mode,
      );
      usaScore = calculateDay2SideNet(
        hole,
        scrambleFor(scrambleScores, match.id, "USA", hole.number),
        day2UsaMatchPH,
        mode,
      );
    } else if (match.format === "DAY3_SINGLES") {
      euScore = calculateDay3PlayerScore(
        hole,
        scoreFor(individualScores, match.id, match.euPlayer, hole.number),
        matchStrokes.get(match.euPlayer) ?? 0,
        mode,
      );
      usaScore = calculateDay3PlayerScore(
        hole,
        scoreFor(individualScores, match.id, match.usaPlayer, hole.number),
        matchStrokes.get(match.usaPlayer) ?? 0,
        mode,
      );
    }

    return {
      hole,
      euScore,
      usaScore,
      winner: calculateHoleWinner(euScore, usaScore),
      detail,
    };
  });

  return calculateMatchState(match.id, results);
}

/** Lowest hole with missing required scores; else 18. */
export function nextHoleForMatch(state: MatchState): number {
  for (const hr of state.holeResults) if (hr.winner === "PENDING") return hr.hole.number;
  return 18;
}

export function throughLabel(state: MatchState): string {
  if (state.holesCompleted === 0) return "";
  if (state.finished) return "";
  return `THRU ${state.throughHole}`;
}

export function findHole(course: Course, holeNumber: number): Hole {
  const h = course.holes.find((x) => x.number === holeNumber);
  if (!h) throw new Error(`Hole ${holeNumber} not found on ${course.name}`);
  return h;
}

/**
 * UI helper — for a Day 2 match, return each side's raw Pair Playing Handicap
 * and their match-relative stroke count (lower plays off zero).
 */
export function day2PairHandicaps(
  match: Extract<AnyMatch, { format: "DAY2_SCRAMBLE" }>,
  players: Player[],
  tee: TeeResolver | undefined,
  scrambleAllowance: ScrambleAllowance = { low: 0.35, high: 0.15 },
): { euPH: number; usaPH: number; euMatch: number; usaMatch: number; euOverride: boolean; usaOverride: boolean } {
  const euPH  = day2SidePlayingHandicap("EU",  match, players, tee, scrambleAllowance);
  const usaPH = day2SidePlayingHandicap("USA", match, players, tee, scrambleAllowance);
  const [euMatch, usaMatch] = matchStrokeAllocation([euPH, usaPH]);
  return {
    euPH, usaPH, euMatch, usaMatch,
    euOverride:  match.euPairHandicap  != null,
    usaOverride: match.usaPairHandicap != null,
  };
}

/**
 * UI helper — for a Day 1 / Day 3 match, return each player's Course Handicap
 * and match-relative match strokes.
 */
export function individualMatchHandicaps(
  match: AnyMatch,
  players: Player[],
  tee: TeeResolver | undefined,
  allowancePercent = 100,
): Map<string, { ch: number; ph: number; matchStrokes: number }> {
  if (match.format === "DAY2_SCRAMBLE") return new Map();
  const ids: string[] =
    match.format === "DAY3_SINGLES"
      ? [match.euPlayer, match.usaPlayer]
      : [...match.euPlayers, ...match.usaPlayers];
  const chs = ids.map((id) => courseHandicapFor(findPlayer(players, id), resolveTeeFor(tee, id)));
  const phs = chs.map((ch) => calculatePlayingHandicap(ch, allowancePercent));
  const rel = matchStrokeAllocation(phs);
  const out = new Map<string, { ch: number; ph: number; matchStrokes: number }>();
  ids.forEach((id, i) => out.set(id, { ch: chs[i], ph: phs[i], matchStrokes: rel[i] }));
  return out;
}

