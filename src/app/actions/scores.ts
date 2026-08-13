"use server";
import { revalidatePath } from "next/cache";
import { requireScorer } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadMatches } from "@/lib/tournamentData";
import { loadRawScores, buildScoringContext } from "@/lib/data";
import { deriveMatchState } from "@/lib/scoring/derive";
import { COURSES } from "@/config/tournament";
import type { AnyMatch } from "@/lib/types";
interface ResolvedIds {
  matchIdBySlug: Map<string, string>;
  playerIdBySlug: Map<string, string>;
  sideIdBy: Map<string, string>;
  holeIdBy: Map<string, string>;
  playersInMatch: Map<string, Set<string>>;
  lockedHolesByMatch: Map<string, Set<number>>;
  signedMatchIds: Set<string>;
}
async function resolveIds(): Promise<ResolvedIds> {
  const sb = supabaseAdmin();
  const [{ data: matches }, { data: players }, { data: sides }, { data: holes }, { data: mp }, { data: locks }] =
    await Promise.all([
      sb.from("matches").select("id, slug, signed_off"),
      sb.from("players").select("id, slug"),
      sb.from("match_sides").select("id, match_id, side_code"),
      sb.from("holes").select("id, hole_number, courses:course_id(slug)"),
      sb.from("match_players").select("match_id, player_id"),
      sb.from("match_hole_locks").select("match_id, hole_number"),
    ]);
  const matchIdBySlug = new Map((matches ?? []).map((m: { slug: string; id: string }) => [m.slug, m.id]));
  const signedMatchIds = new Set(
    (matches ?? []).filter((m: { id: string; signed_off: boolean }) => m.signed_off).map((m: { id: string }) => m.id),
  );
  const playerIdBySlug = new Map((players ?? []).map((p: { slug: string; id: string }) => [p.slug, p.id]));
  const sideIdBy = new Map(
    (sides ?? []).map((s: { id: string; match_id: string; side_code: string }) => [`${s.match_id}:${s.side_code}`, s.id]),
  );
  const holeIdBy = new Map(
    (holes ?? []).map((h: { id: string; hole_number: number; courses: { slug: string } | { slug: string }[] }) => {
      const course = Array.isArray(h.courses) ? h.courses[0] : h.courses;
      return [`${course.slug}:${h.hole_number}`, h.id];
    }),
  );
  const playersInMatch = new Map<string, Set<string>>();
  for (const row of (mp ?? []) as { match_id: string; player_id: string }[]) {
    const set = playersInMatch.get(row.match_id) ?? new Set<string>();
    set.add(row.player_id);
    playersInMatch.set(row.match_id, set);
  }
  const lockedHolesByMatch = new Map<string, Set<number>>();
  for (const row of (locks ?? []) as { match_id: string; hole_number: number }[]) {
    const set = lockedHolesByMatch.get(row.match_id) ?? new Set<number>();
    set.add(row.hole_number);
    lockedHolesByMatch.set(row.match_id, set);
  }
  return { matchIdBySlug, playerIdBySlug, sideIdBy, holeIdBy, playersInMatch, lockedHolesByMatch, signedMatchIds };
}
function assertHoleUnlocked(ids: ResolvedIds, matchId: string, holeNumber: number) {
  if (ids.signedMatchIds.has(matchId)) {
    throw new Error("This scorecard is signed — unlock it to change the score");
  }
  if (ids.lockedHolesByMatch.get(matchId)?.has(holeNumber)) {
    throw new Error("This hole is locked — unlock it to change the score");
  }
}
async function matchBySlug(slug: string): Promise<AnyMatch> {
  const m = (await loadMatches()).find((x) => x.id === slug);
  if (!m) throw new Error(`Unknown match '${slug}'`);
  return m;
}
function validateGross(n: unknown): number {
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 20) {
    throw new Error("Invalid gross score (must be an integer 1..20)");
  }
  return n;
}
function validateHole(n: unknown): number {
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 18) {
    throw new Error("Invalid hole number");
  }
  return n;
}
function revalidateForMatch(matchSlug: string, playerSlug?: string) {
  revalidatePath(`/matches/${matchSlug}`);
  revalidatePath(`/score/${matchSlug}`);
  revalidatePath("/");
  revalidatePath("/players");
  if (playerSlug) revalidatePath(`/players/${playerSlug}`);
}
interface IndividualInput {
  matchSlug: string;
  playerSlug: string;
  holeNumber: number;
  gross: number;
}
async function assertIndividualWriteAllowed(
  input: IndividualInput,
  ids: ResolvedIds,
): Promise<{ matchId: string; playerId: string; holeId: string }> {
  const cfg = await matchBySlug(input.matchSlug);
  if (cfg.format === "DAY2_SCRAMBLE") {
    throw new Error("Individual scores are not permitted for Day 2 (scramble)");
  }
  const matchId = ids.matchIdBySlug.get(input.matchSlug);
  const playerId = ids.playerIdBySlug.get(input.playerSlug);
  if (!matchId || !playerId) throw new Error("Unknown match or player");
  const set = ids.playersInMatch.get(matchId);
  if (!set || !set.has(playerId)) throw new Error("Player is not a participant in this match");
  const expected = cfg.format === "DAY3_SINGLES"
    ? [cfg.euPlayer, cfg.usaPlayer]
    : [...cfg.euPlayers, ...cfg.usaPlayers];
  if (!expected.includes(input.playerSlug)) {
    throw new Error("Player slug is not in this match's current pairing");
  }
  const holeId = ids.holeIdBy.get(`${cfg.courseId}:${input.holeNumber}`);
  if (!holeId) throw new Error("Hole does not belong to this match's course");
  assertHoleUnlocked(ids, matchId, input.holeNumber);
  return { matchId, playerId, holeId };
}
export async function upsertIndividualScore(input: IndividualInput) {
  requireScorer();
  validateHole(input.holeNumber);
  validateGross(input.gross);
  const ids = await resolveIds();
  const { matchId, playerId, holeId } = await assertIndividualWriteAllowed(input, ids);
  const { error } = await supabaseAdmin().from("scores").upsert(
    { match_id: matchId, player_id: playerId, hole_id: holeId, gross_score: input.gross },
    { onConflict: "match_id,player_id,hole_id" },
  );
  if (error) throw error;
  revalidateForMatch(input.matchSlug, input.playerSlug);
}
export async function deleteIndividualScore(input: Omit<IndividualInput, "gross">) {
  requireScorer();
  validateHole(input.holeNumber);
  const ids = await resolveIds();
  const { matchId, playerId, holeId } = await assertIndividualWriteAllowed(
    { ...input, gross: 1 }, ids,
  );
  await supabaseAdmin().from("scores").delete()
    .match({ match_id: matchId, player_id: playerId, hole_id: holeId });
  revalidateForMatch(input.matchSlug, input.playerSlug);
}
interface ScrambleInput {
  matchSlug: string;
  side: "EU" | "USA";
  holeNumber: number;
  gross: number;
}
async function assertScrambleWriteAllowed(
  input: ScrambleInput,
  ids: ResolvedIds,
): Promise<{ matchId: string; sideId: string; holeId: string }> {
  if (input.side !== "EU" && input.side !== "USA") throw new Error("Invalid side");
  const cfg = await matchBySlug(input.matchSlug);
  if (cfg.format !== "DAY2_SCRAMBLE") {
    throw new Error("Scramble scores are only permitted for Day 2");
  }
  const matchId = ids.matchIdBySlug.get(input.matchSlug);
  if (!matchId) throw new Error("Unknown match");
  const sideId = ids.sideIdBy.get(`${matchId}:${input.side}`);
  if (!sideId) throw new Error("Side does not belong to this match");
  const holeId = ids.holeIdBy.get(`${cfg.courseId}:${input.holeNumber}`);
  if (!holeId) throw new Error("Hole does not belong to this match's course");
  assertHoleUnlocked(ids, matchId, input.holeNumber);
  return { matchId, sideId, holeId };
}
export async function upsertScrambleScore(input: ScrambleInput) {
  requireScorer();
  validateHole(input.holeNumber);
  validateGross(input.gross);
  const ids = await resolveIds();
  const { matchId, sideId, holeId } = await assertScrambleWriteAllowed(input, ids);
  const { error } = await supabaseAdmin().from("scramble_scores").upsert(
    { match_id: matchId, match_side_id: sideId, hole_id: holeId, gross_score: input.gross },
    { onConflict: "match_id,match_side_id,hole_id" },
  );
  if (error) throw error;
  revalidateForMatch(input.matchSlug);
}
export async function deleteScrambleScore(input: Omit<ScrambleInput, "gross">) {
  requireScorer();
  validateHole(input.holeNumber);
  const ids = await resolveIds();
  const { matchId, sideId, holeId } = await assertScrambleWriteAllowed(
    { ...input, gross: 1 }, ids,
  );
  await supabaseAdmin().from("scramble_scores").delete()
    .match({ match_id: matchId, match_side_id: sideId, hole_id: holeId });
  revalidateForMatch(input.matchSlug);
}
export async function setHoleLock(input: { matchSlug: string; holeNumber: number; locked: boolean }) {
  requireScorer();
  validateHole(input.holeNumber);
  const ids = await resolveIds();
  const matchId = ids.matchIdBySlug.get(input.matchSlug);
  if (!matchId) throw new Error("Unknown match");
  if (ids.signedMatchIds.has(matchId)) {
    throw new Error("This scorecard is signed — unlock it to change hole locks");
  }
  const sb = supabaseAdmin();
  if (input.locked) {
    const { error } = await sb.from("match_hole_locks").upsert(
      { match_id: matchId, hole_number: input.holeNumber },
      { onConflict: "match_id,hole_number" },
    );
    if (error) throw error;
  } else {
    const { error } = await sb.from("match_hole_locks").delete()
      .match({ match_id: matchId, hole_number: input.holeNumber });
    if (error) throw error;
  }
  revalidateForMatch(input.matchSlug);
}
export async function setMatchSigned(input: { matchSlug: string; signed: boolean }) {
  requireScorer();
  const ids = await resolveIds();
  const matchId = ids.matchIdBySlug.get(input.matchSlug);
  if (!matchId) throw new Error("Unknown match");
  if (input.signed) {
    const cfg = await matchBySlug(input.matchSlug);
    const { individualScores, scrambleScores } = await loadRawScores();
    const ctx = await buildScoringContext(individualScores, scrambleScores);
    const course = COURSES.find((c) => c.id === cfg.courseId)!;
    const state = deriveMatchState({
      match: cfg, course, players: ctx.players,
      individualScores, scrambleScores, mode: "NET",
      tee: (playerId: string) => ctx.getTeeForMatch(cfg, playerId),
      scrambleAllowance: ctx.scrambleAllowance,
      lockedHoles: ctx.lockedHolesByMatch.get(cfg.id) ?? null,
    });
    if (!state.finished) {
      throw new Error("Match isn't decided yet — can't sign until the result is final");
    }
  }
  const { error } = await supabaseAdmin().from("matches").update({ signed_off: input.signed }).eq("id", matchId);
  if (error) throw error;
  revalidateForMatch(input.matchSlug);
}
