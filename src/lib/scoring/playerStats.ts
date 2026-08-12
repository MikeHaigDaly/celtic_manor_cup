import type {
  AnyMatch,
  Course,
  IndividualScore,
  MatchState,
  Player,
  ScoringMode,
  ScrambleAllowance,
  ScrambleScore,
  Tee,
} from "@/lib/types";
import { deriveMatchState, courseHandicapFor } from "./derive";
import { getHandicapStrokes } from "./handicap";
import { calculatePlayingHandicap } from "./courseHandicap";

export interface PlayerStats {
  playerId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  halves: number;
  cupPointsContributed: number;
  holesWon: number;
  holesLost: number;
  holesHalved: number;
  individualGrossToPar: number | null;
  individualNetToPar: number | null;
  par3ToPar: number | null;
  par4ToPar: number | null;
  par5ToPar: number | null;
  bestHole: { score: number; toPar: number; hole: number; matchId: string } | null;
  worstHole: { score: number; toPar: number; hole: number; matchId: string } | null;
  perMatch: { matchId: string; day: 1 | 2 | 3; text: string }[];
  /** Course Handicap per day (for display). */
  courseHandicaps: { day: 1 | 2 | 3; courseHandicap: number; teeId: string }[];
}

interface Ctx {
  players: Player[];
  matches: AnyMatch[];
  courses: Course[];
  individualScores: IndividualScore[];
  scrambleScores: ScrambleScore[];
  /** Resolve the tee a specific player is using for a match's round. */
  getTeeForMatch: (match: AnyMatch, playerId: string) => Tee | null;
  /** Optional Day 2 scramble allowance (default 35/15). */
  scrambleAllowance?: ScrambleAllowance;
  /** Handicap allowance % applied to CH → PH (default 100). */
  allowancePercent?: number;
}

const courseFor = (courses: Course[], id: string) => {
  const c = courses.find((x) => x.id === id);
  if (!c) throw new Error(`Course not found: ${id}`);
  return c;
};

/** Compute derived state for every match (mode = NET, official). */
export function deriveAllMatchStates(ctx: Ctx, mode: ScoringMode = "NET"): Map<string, MatchState> {
  const out = new Map<string, MatchState>();
  for (const m of ctx.matches) {
    out.set(
      m.id,
      deriveMatchState({
        match: m,
        course: courseFor(ctx.courses, m.courseId),
        players: ctx.players,
        individualScores: ctx.individualScores,
        scrambleScores: ctx.scrambleScores,
        mode,
        tee: (playerId: string) => ctx.getTeeForMatch(m, playerId),
        allowancePercent: ctx.allowancePercent,
        scrambleAllowance: ctx.scrambleAllowance,
      }),
    );
  }
  return out;
}

/**
 * Player statistics.
 * Individual stroke stats use Day 1 + Day 3 individual scores ONLY.
 * Day 2 scramble contributes to matches played, W-L-H and Cup points only.
 *
 * For individual to-par computations we use the player's *Playing Handicap*
 * on that match's selected tee (allowance %). Match-play stroke allocation is
 * a match-level construct and is not used for these stats.
 */
export function calculatePlayerStats(playerId: string, ctx: Ctx): PlayerStats {
  const player = ctx.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`Unknown player ${playerId}`);
  const allowance = ctx.allowancePercent ?? 100;
  const states = deriveAllMatchStates(ctx, "NET");

  let matchesPlayed = 0;
  let wins = 0, losses = 0, halves = 0;
  let cupPointsContributed = 0;
  let holesWon = 0, holesLost = 0, holesHalved = 0;
  const perMatch: PlayerStats["perMatch"] = [];

  for (const match of ctx.matches) {
    const state = states.get(match.id)!;
    const isPlayerInMatch =
      (match.format === "DAY1_PAR_PAIRS" && (match.euPlayers.includes(playerId) || match.usaPlayers.includes(playerId))) ||
      (match.format === "DAY2_SCRAMBLE" && (match.euPlayers.includes(playerId) || match.usaPlayers.includes(playerId))) ||
      (match.format === "DAY3_SINGLES" && (match.euPlayer === playerId || match.usaPlayer === playerId));
    if (!isPlayerInMatch) continue;
    if (state.holesCompleted === 0) continue;

    matchesPlayed++;
    const side: "EU" | "USA" =
      match.format === "DAY3_SINGLES"
        ? (match.euPlayer === playerId ? "EU" : "USA")
        : (match.euPlayers.includes(playerId) ? "EU" : "USA");

    for (const hr of state.holeResults) {
      if (hr.winner === "PENDING") continue;
      if (hr.winner === "HALVED") holesHalved++;
      else if (hr.winner === side) holesWon++;
      else holesLost++;
    }

    if (state.finished) {
      if (state.leadTeam === side) { wins++; cupPointsContributed += 1; }
      else if (state.leadTeam == null && state.statusText === "HALVED") { halves++; cupPointsContributed += 0.5; }
      else { losses++; }
    }

    perMatch.push({ matchId: match.id, day: match.dayNumber, text: state.statusText });
  }

  // Individual stroke stats — Day 1 + Day 3 individual scores only
  const courseMap = new Map(ctx.courses.map((c) => [c.id, c]));
  let indGross = 0, indNet = 0, indPar = 0;
  const perPar: Record<3 | 4 | 5, { g: number; par: number; count: number }> = {
    3: { g: 0, par: 0, count: 0 },
    4: { g: 0, par: 0, count: 0 },
    5: { g: 0, par: 0, count: 0 },
  };
  let bestHole: PlayerStats["bestHole"] = null;
  let worstHole: PlayerStats["worstHole"] = null;
  let hasAny = false;

  for (const s of ctx.individualScores) {
    if (s.playerId !== playerId) continue;
    const m = ctx.matches.find((x) => x.id === s.matchId);
    if (!m) continue;
    if (m.format === "DAY2_SCRAMBLE") continue; // safety
    const c = courseMap.get(m.courseId);
    if (!c) continue;
    const hole = c.holes.find((h) => h.number === s.holeNumber);
    if (!hole) continue;
    const state = states.get(m.id)!;
    if (hole.number > state.throughHole && state.finished) continue;

    const tee = ctx.getTeeForMatch(m, player.id);
    const ch = courseHandicapFor(player, tee);
    const ph = calculatePlayingHandicap(ch, allowance);
    const strokes = getHandicapStrokes(ph, hole.strokeIndex);
    const net = s.gross - strokes;

    hasAny = true;
    indGross += s.gross;
    indNet += net;
    indPar += hole.par;
    perPar[hole.par].g += s.gross;
    perPar[hole.par].par += hole.par;
    perPar[hole.par].count++;

    const toParG = s.gross - hole.par;
    if (!bestHole || toParG < bestHole.toPar) bestHole = { score: s.gross, toPar: toParG, hole: hole.number, matchId: m.id };
    if (!worstHole || toParG > worstHole.toPar) worstHole = { score: s.gross, toPar: toParG, hole: hole.number, matchId: m.id };
  }

  const parToParFor = (p: 3 | 4 | 5): number | null =>
    perPar[p].count > 0 ? perPar[p].g - perPar[p].par : null;

  // Course Handicap per day (display convenience)
  const seenDays = new Set<number>();
  const courseHandicaps: PlayerStats["courseHandicaps"] = [];
  for (const m of ctx.matches) {
    if (seenDays.has(m.dayNumber)) continue;
    seenDays.add(m.dayNumber);
    const tee = ctx.getTeeForMatch(m, player.id);
    if (!tee) continue;
    courseHandicaps.push({
      day: m.dayNumber,
      courseHandicap: courseHandicapFor(player, tee),
      teeId: tee.id,
    });
  }

  return {
    playerId,
    matchesPlayed,
    wins,
    losses,
    halves,
    cupPointsContributed,
    holesWon,
    holesLost,
    holesHalved,
    individualGrossToPar: hasAny ? indGross - indPar : null,
    individualNetToPar:   hasAny ? indNet   - indPar : null,
    par3ToPar: parToParFor(3),
    par4ToPar: parToParFor(4),
    par5ToPar: parToParFor(5),
    bestHole,
    worstHole,
    perMatch,
    courseHandicaps,
  };
}

