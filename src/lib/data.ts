import { supabaseServer } from "./supabase/server";
import type { AnyMatch, IndividualScore, ScrambleScore, Tee } from "./types";
import { COURSES, SCRAMBLE_ALLOWANCE } from "@/config/tournament";
import {
  loadMatches, loadPlayers, loadPlayerTeeSelections, loadRoundSettings, teeForPlayerFromSelections,
} from "./tournamentData";
import { withRetry } from "./retry";

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

  const [
    { data: ind, error: indErr },
    { data: scr, error: scrErr },
  ] = await withRetry(() => Promise.all([
    // Individual scores (Day 1 + Day 3)
    sb.from("scores")
      .select("gross_score, matches!inner(slug), players!inner(slug), holes!inner(hole_number, course_id, courses!inner(slug))"),
    // Scramble scores (Day 2)
    sb.from("scramble_scores")
      .select("gross_score, matches!inner(slug), match_sides!inner(side_code), holes!inner(hole_number)"),
  ]));
  if (indErr) throw indErr;
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

/** Locked hole numbers for every match, keyed by match slug. */
async function loadAllLockedHoles(): Promise<Map<string, Set<number>>> {
  const sb = supabaseServer();
  const { data, error } = await withRetry(() => sb
    .from("match_hole_locks")
    .select("hole_number, matches!inner(slug)"));
  if (error) throw error;
  const out = new Map<string, Set<number>>();
  for (const r of (data ?? []) as any[]) {
    const slug = r.matches.slug as string;
    const set = out.get(slug) ?? new Set<number>();
    set.add(r.hole_number as number);
    out.set(slug, set);
  }
  return out;
}

/** Match slugs that have been signed off (finalized) — blocks further edits. */
async function loadSignedMatches(): Promise<Set<string>> {
  const sb = supabaseServer();
  const { data, error } = await withRetry(() =>
    sb.from("matches").select("slug, signed_off").eq("signed_off", true));
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => r.slug as string));
}

/**
 * Build the derivation context for use with `deriveAllMatchStates`. Fetches
 * raw scores and all setup/lock data in a single parallel wave — callers
 * used to `await loadRawScores()` then `await buildScoringContext(...)` as
 * two sequential round trips even though neither depends on the other.
 */
export async function buildScoringContext() {
  const [
    { individualScores, scrambleScores },
    players,
    matches,
    roundSettings,
    playerTeeSelections,
    lockedHolesByMatch,
    signedMatches,
  ] = await withRetry(() => Promise.all([
    loadRawScores(),
    loadPlayers(),
    loadMatches(),
    loadRoundSettings(),
    loadPlayerTeeSelections(),
    loadAllLockedHoles(),
    loadSignedMatches(),
  ]));
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
    lockedHolesByMatch,
    signedMatches,
  };
}

