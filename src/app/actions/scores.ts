"use server";
import { revalidatePath } from "next/cache";
import { requireScorer } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadMatches } from "@/lib/tournamentData";
import type { AnyMatch } from "@/lib/types";
interface ResolvedIds {
  matchIdBySlug: Map<string, string>;
  playerIdBySlug: Map<string, string>;
  sideIdBy: Map<string, string>;
  holeIdBy: Map<string, string>;
  playersInMatch: Map<string, Set<string>>;
}
async function resolveIds(): Promise<ResolvedIds> {
  const sb = supabaseAdmin();
  const [{ data: matches }, { data: players }, { data: sides }, { data: holes }, { data: mp }] =
    await Promise.all([
      sb.from("matches").select("id, slug"),
      sb.from("players").select("id, slug"),
      sb.from("match_sides").select("id, match_id, side_code"),
      sb.from("holes").select("id, hole_number, courses:course_id(slug)"),
      sb.from("match_players").select("match_id, player_id"),
    ]);
  const matchIdBySlug = new Map((matches ?? []).map((m: { slug: string; id: string }) => [m.slug, m.id]));
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
  return { matchIdBySlug, playerIdBySlug, sideIdBy, holeIdBy, playersInMatch };
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
