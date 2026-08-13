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
  /**
   * Holes locked for this match. When supplied, any hole NOT in this set is
   * forced to PENDING regardless of entered scores — a hole only officially
   * counts (and the match can only progress past it) once it's locked.
   * Omit/null to not gate on locking (e.g. tests, or callers with no lock data).
   */
  lockedHoles?: Set<number> | null;
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
 * Strokes-received map for the players in a match — each player's own
 * Playing Handicap (Course Handicap × allowance) applied directly against
 * hole Stroke Index, with no match-relative "subtract the lowest" step.
 * Simpler to follow scorer-side than a relative allowance.
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
  const out = new Map<string, number>();
  ids.forEach((id) => {
    const p = findPlayer(players, id);
    const ch = courseHandicapFor(p, resolveTeeFor(tee, id));
    out.set(id, Math.max(0, calculatePlayingHandicap(ch, allowancePercent)));
  });
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
 *     → Playing Handicap (via allowance %; Day 2 blends the pair's two CHs
 *       35/15 low/high — see day2SidePlayingHandicap) — applied directly,
 *       no match-relative adjustment, same convention for all three days
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
  lockedHoles = null,
}: DeriveInput): MatchState {
  const holes = [...course.holes].sort((a, b) => a.number - b.number);

  // Precompute match strokes for individual formats
  const matchStrokes =
    match.format === "DAY2_SCRAMBLE"
      ? new Map<string, number>()
      : computeMatchStrokesForMatch(match, players, tee, allowancePercent);

  // Precompute Day 2 pair Playing Handicaps — applied directly by hole SI,
  // same convention as Day 1/3 (no match-relative subtract-the-lower-pair).
  let day2EuPH = 0;
  let day2UsaPH = 0;
  if (match.format === "DAY2_SCRAMBLE") {
    day2EuPH  = day2SidePlayingHandicap("EU",  match, players, tee, scrambleAllowance);
    day2UsaPH = day2SidePlayingHandicap("USA", match, players, tee, scrambleAllowance);
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
        day2EuPH,
        mode,
      );
      usaScore = calculateDay2SideNet(
        hole,
        scrambleFor(scrambleScores, match.id, "USA", hole.number),
        day2UsaPH,
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

    const isLocked = lockedHoles == null || lockedHoles.has(hole.number);
    return {
      hole,
      euScore,
      usaScore,
      winner: isLocked ? calculateHoleWinner(euScore, usaScore) : "PENDING",
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
 * UI helper — for a Day 2 match, return each side's Pair Playing Handicap
 * (applied directly by hole SI — same convention as Day 1/3's Course Handicap).
 */
export function day2PairHandicaps(
  match: Extract<AnyMatch, { format: "DAY2_SCRAMBLE" }>,
  players: Player[],
  tee: TeeResolver | undefined,
  scrambleAllowance: ScrambleAllowance = { low: 0.35, high: 0.15 },
): { euPH: number; usaPH: number; euOverride: boolean; usaOverride: boolean } {
  const euPH  = day2SidePlayingHandicap("EU",  match, players, tee, scrambleAllowance);
  const usaPH = day2SidePlayingHandicap("USA", match, players, tee, scrambleAllowance);
  return {
    euPH, usaPH,
    euOverride:  match.euPairHandicap  != null,
    usaOverride: match.usaPairHandicap != null,
  };
}

/**
 * UI helper — for a Day 1 / Day 3 match, return each player's Course Handicap
 * and the strokes they receive (their own Playing Handicap, applied directly
 * by hole Stroke Index — no match-relative adjustment).
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
  const phs = chs.map((ch) => Math.max(0, calculatePlayingHandicap(ch, allowancePercent)));
  const out = new Map<string, { ch: number; ph: number; matchStrokes: number }>();
  ids.forEach((id, i) => out.set(id, { ch: chs[i], ph: phs[i], matchStrokes: phs[i] }));
  return out;
}

