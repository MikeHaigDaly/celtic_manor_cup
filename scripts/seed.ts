/**
 * Seeds Supabase from src/config/tournament.ts.
 * Idempotent — safe to re-run after editing the config.
 *
 *   npm run seed
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  COURSES, DAY1_MATCHES, DAY2_MATCHES, DAY3_MATCHES,
  PLAYERS, TOURNAMENT, ROUND_SETTINGS,
} from "../src/config/tournament";
import { validateAllCourses } from "../src/lib/config/validate";
interface RowWithId { id: string }
interface CourseIdRow extends RowWithId { slug: string }
interface HoleIdRow  extends RowWithId { course_id: string; hole_number: number }
interface TeeIdRow   extends RowWithId { slug: string }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE URL or SERVICE ROLE KEY in env.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
async function upsert<T extends object, R = T & RowWithId>(
  table: string, rows: T[], onConflict: string,
): Promise<R[]> {
  const { data, error } = await sb.from(table).upsert(rows, { onConflict }).select();
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as R[];
}
async function main() {
  validateAllCourses(COURSES);
  console.log("→ Tournament");
  const [tournament] = await upsert<
    { slug: string; name: string; year: number; status: string },
    { id: string }
  >("tournaments", [{
    slug: "celtic-manor-cup", name: TOURNAMENT.name, year: TOURNAMENT.year, status: "active",
  }], "slug");
  const tournamentId = tournament.id;
  console.log("→ Teams");
  const teamsData = await upsert<
    { tournament_id: string; code: "EU" | "USA"; name: string; short_name: string; sort_order: number },
    { id: string; code: "EU" | "USA" }
  >("teams", [
    { tournament_id: tournamentId, code: "EU",  name: "Team Europe", short_name: "EU",  sort_order: 1 },
    { tournament_id: tournamentId, code: "USA", name: "Team USA",    short_name: "USA", sort_order: 2 },
  ], "tournament_id,code");
  const teamId: Record<"EU" | "USA", string> = {
    EU:  teamsData.find((t) => t.code === "EU")!.id,
    USA: teamsData.find((t) => t.code === "USA")!.id,
  };
  console.log("→ Players (create if missing — name/HI/team are live-edited from /teams, never overwritten here)");
  const { data: existingPlayerRows, error: existingPlayersErr } = await sb
    .from("players").select("id, slug").eq("tournament_id", tournamentId);
  if (existingPlayersErr) throw existingPlayersErr;
  const existingSlugs = new Set((existingPlayerRows ?? []).map((p: any) => p.slug as string));
  const newPlayerRows = PLAYERS
    .filter((p) => !existingSlugs.has(p.id))
    .map((p, i) => ({
      tournament_id: tournamentId,
      team_id: p.team ? teamId[p.team] : null,
      slug: p.id,
      name: p.name,
      handicap_index: p.handicapIndex,
      photo_url: p.photoUrl ?? null,
      sort_order: existingSlugs.size + i,
    }));
  if (newPlayerRows.length > 0) {
    const { error: insErr } = await sb.from("players").insert(newPlayerRows);
    if (insErr) throw new Error(`players: ${insErr.message}`);
  }
  const { data: playersDb, error: playersSelErr } = await sb
    .from("players").select("id, slug").eq("tournament_id", tournamentId);
  if (playersSelErr) throw playersSelErr;
  const playerId = new Map<string, string>();
  for (const p of playersDb ?? []) playerId.set(p.slug, p.id);
  console.log("→ Courses & holes");
  const courseRows = COURSES.map((c) => ({ slug: c.id, name: c.name }));
  const coursesDb = await upsert<typeof courseRows[number], CourseIdRow>("courses", courseRows, "slug");
  const courseId = new Map<string, string>();
  for (const c of coursesDb) courseId.set(c.slug, c.id);
  const holeRows = COURSES.flatMap((c) =>
    c.holes.map((h) => ({
      course_id: courseId.get(c.id)!,
      hole_number: h.number,
      par: h.par,
      stroke_index: h.strokeIndex,
      yardage: null,
    })),
  );
  await upsert("holes", holeRows, "course_id,hole_number");
  const { data: allHoles, error: hErr } = await sb.from("holes").select("id, course_id, hole_number");
  if (hErr) throw hErr;
  const holeIdBy = new Map<string, string>();
  for (const h of (allHoles ?? []) as HoleIdRow[]) holeIdBy.set(`${h.course_id}:${h.hole_number}`, h.id);
  console.log("→ Tees");
  const teeRows = COURSES.flatMap((c) =>
    c.tees.map((t) => ({
      course_id: courseId.get(c.id)!,
      slug: t.id,
      name: t.name,
      gender: t.gender ?? null,
      course_rating: t.courseRating,
      slope_rating: t.slopeRating,
      par: t.par,
      total_yardage: t.totalYardage ?? null,
    })),
  );
  const teesDb = await upsert<typeof teeRows[number], TeeIdRow>("tees", teeRows, "course_id,slug");
  const teeIdBySlug = new Map<string, string>();
  for (const t of teesDb) teeIdBySlug.set(t.slug, t.id);
  console.log("→ Per-tee hole yardages");
  const tyRows: { tee_id: string; hole_id: string; yardage: number }[] = [];
  for (const c of COURSES) {
    for (const t of c.tees) {
      if (!t.holeYardages) continue;
      t.holeYardages.forEach((y, i) => {
        tyRows.push({
          tee_id: teeIdBySlug.get(t.id)!,
          hole_id: holeIdBy.get(`${courseId.get(c.id)}:${i + 1}`)!,
          yardage: y,
        });
      });
    }
  }
  if (tyRows.length > 0) {
    await upsert("tee_hole_yardages", tyRows, "tee_id,hole_id");
  }
  console.log("→ Rounds (with selected tee)");
  const roundRows = ROUND_SETTINGS.map((r) => ({
    tournament_id: tournamentId,
    day_number: r.dayNumber,
    course_id: courseId.get(r.courseId)!,
    selected_tee_id: teeIdBySlug.get(r.selectedTeeId) ?? null,
    name:
      r.dayNumber === 1 ? "Day 1 · Best/Worst/Both" :
      r.dayNumber === 2 ? "Day 2 · Scramble" :
      "Day 3 · Singles",
    format:
      r.dayNumber === 1 ? "DAY1_PAR_PAIRS" :
      r.dayNumber === 2 ? "DAY2_SCRAMBLE" :
      "DAY3_SINGLES",
  }));
  const roundsDb = await upsert<
    typeof roundRows[number],
    { id: string; day_number: number }
  >("rounds", roundRows, "tournament_id,day_number");
  const roundIdByDay = new Map<number, string>();
  for (const r of roundsDb) roundIdByDay.set(r.day_number, r.id);
  console.log("→ Matches");
  const allMatches = [...DAY1_MATCHES, ...DAY2_MATCHES, ...DAY3_MATCHES];
  const matchRows = allMatches.map((m, i) => ({
    round_id: roundIdByDay.get(m.dayNumber)!,
    slug: m.id,
    match_number: m.matchNumber,
    display_order: i,
  }));
  const matchesDb = await upsert<
    typeof matchRows[number],
    { id: string; slug: string }
  >("matches", matchRows, "round_id,slug");
  const matchId = new Map<string, string>();
  for (const m of matchesDb) matchId.set(m.slug, m.id);
  console.log("→ Match sides + players");
  interface SideRow {
    match_id: string; team_id: string; side_code: "EU" | "USA";
    pair_handicap_override: number | null;
  }
  const sideRows: SideRow[] = [];
  for (const m of allMatches) {
    const euOverride  = m.format === "DAY2_SCRAMBLE" ? (m.euPairHandicap  ?? null) : null;
    const usaOverride = m.format === "DAY2_SCRAMBLE" ? (m.usaPairHandicap ?? null) : null;
    sideRows.push({ match_id: matchId.get(m.id)!, team_id: teamId.EU,  side_code: "EU",  pair_handicap_override: euOverride  });
    sideRows.push({ match_id: matchId.get(m.id)!, team_id: teamId.USA, side_code: "USA", pair_handicap_override: usaOverride });
  }
  const sidesDb = await upsert<
    SideRow,
    { id: string; match_id: string; side_code: "EU" | "USA" }
  >("match_sides", sideRows, "match_id,side_code");
  const sideId = new Map<string, string>();
  for (const s of sidesDb) sideId.set(`${s.match_id}:${s.side_code}`, s.id);
  interface MpRow { match_id: string; match_side_id: string; player_id: string; pairing_position: number }
  const mpRows: MpRow[] = [];
  for (const m of allMatches) {
    const mId = matchId.get(m.id)!;
    const euIds  = m.format === "DAY3_SINGLES" ? [m.euPlayer]  : m.euPlayers;
    const usaIds = m.format === "DAY3_SINGLES" ? [m.usaPlayer] : m.usaPlayers;
    euIds.forEach((pid, idx) => mpRows.push({
      match_id: mId, match_side_id: sideId.get(`${mId}:EU`)!,
      player_id: playerId.get(pid)!, pairing_position: idx + 1,
    }));
    usaIds.forEach((pid, idx) => mpRows.push({
      match_id: mId, match_side_id: sideId.get(`${mId}:USA`)!,
      player_id: playerId.get(pid)!, pairing_position: idx + 1,
    }));
  }
  await upsert("match_players", mpRows, "match_id,player_id");

  console.log("→ Player tee selections (defaults; existing picks are never overwritten)");
  const teeSelectionRows = playersDb.flatMap((p) =>
    roundRows.map((r) => ({
      player_id: p.id,
      round_id: roundIdByDay.get(r.day_number)!,
      tee_id: r.selected_tee_id!,
    })),
  );
  const { error: teeSelErr } = await sb
    .from("player_tee_selections")
    .upsert(teeSelectionRows, { onConflict: "player_id,round_id", ignoreDuplicates: true });
  if (teeSelErr) throw new Error(`player_tee_selections: ${teeSelErr.message}`);

  console.log("✓ Seed complete.");
}
main().catch((err) => { console.error(err); process.exit(1); });
