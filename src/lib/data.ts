import { supabaseServer } from "./supabase/server";
import type { AnyMatch, IndividualScore, ScrambleScore, Tee } from "./types";
import { COURSES, SCRAMBLE_ALLOWANCE } from "@/config/tournament";
import {
  loadMatches, loadPlayers, loadPlayerTeeSelections, loadRoundSettings, teeForPlayerFromSelections,
} from "./tournamentData";

/**
 * Load raw score rows from Supabase and translate them to the domain shapes
 * used by the scoring engine (which key by slug/matchId, not UUID).
 *
 * We rely on the seed script having populated matches.slug = config match id,
 * players.slug = player.id, and holes indexed by (course, hole_number).
 */
export async function loadRawScores(): Promise<{
  individualScores: IndividualScore[];
  scrambleScores: ScrambleScore[];
}> {
  const sb = supabaseServer();

  // Individual scores (Day 1 + Day 3)
  const { data: ind, error: indErr } = await sb
    .from("scores")
    .select("gross_score, matches!inner(slug), players!inner(slug), holes!inner(hole_number, course_id, courses!inner(slug))");
  if (indErr) throw indErr;

  // Scramble scores (Day 2)
  const { data: scr, error: scrErr } = await sb
    .from("scramble_scores")
    .select("gross_score, matches!inner(slug), match_sides!inner(side_code), holes!inner(hole_number)");
  if (scrErr) throw scrErr;

  const individualScores: IndividualScore[] = (ind ?? []).map((r: any) => ({
    matchId: r.matches.slug,
    playerId: r.players.slug,
    holeNumber: r.holes.hole_number,
    gross: r.gross_score,
  }));

  const scrambleScores: ScrambleScore[] = (scr ?? []).map((r: any) => ({
    matchId: r.matches.slug,
    side: r.match_sides.side_code,
    holeNumber: r.holes.hole_number,
    gross: r.gross_score,
  }));

  return { individualScores, scrambleScores };
}

/** Build the derivation context for use with `deriveAllMatchStates`. */
export async function buildScoringContext(
  individualScores: IndividualScore[],
  scrambleScores: ScrambleScore[],
) {
  const [players, matches, roundSettings, playerTeeSelections] = await Promise.all([
    loadPlayers(),
    loadMatches(),
    loadRoundSettings(),
    loadPlayerTeeSelections(),
  ]);
  return {
    players,
    matches,
    courses: COURSES,
    individualScores,
    scrambleScores,
    getTeeForMatch: (m: AnyMatch, playerId: string): Tee =>
      teeForPlayerFromSelections(m, playerId, playerTeeSelections, roundSettings),
    scrambleAllowance: SCRAMBLE_ALLOWANCE,
    allowancePercent: 100,
  };
}

