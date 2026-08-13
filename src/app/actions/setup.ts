"use server";
import { revalidatePath } from "next/cache";
import { requireTeamsEditor } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { TeamCode } from "@/lib/types";

function validateHandicap(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n < -10 || n > 54) {
    throw new Error("Invalid handicap index (must be a number between -10.0 and 54.0)");
  }
  return Math.round(n * 10) / 10;
}

function validateTeam(t: unknown): TeamCode {
  if (t !== "EU" && t !== "USA") throw new Error("Invalid team");
  return t;
}

function validateTeamOrNull(t: unknown): TeamCode | null {
  if (t === null) return null;
  return validateTeam(t);
}

function validateName(n: unknown): string {
  if (typeof n !== "string") throw new Error("Invalid name");
  const trimmed = n.trim();
  if (trimmed.length < 1 || trimmed.length > 40) {
    throw new Error("Name must be between 1 and 40 characters");
  }
  return trimmed;
}

interface SetupIds {
  tournamentId: string;
  teamsLocked: boolean;
  teamIdByCode: Map<TeamCode, string>;
  playerIdBySlug: Map<string, string>;
  playerTeamBySlug: Map<string, TeamCode>;
  roundIdByDay: Map<1 | 2 | 3, { id: string; courseId: string }>;
  teeIdBySlug: Map<string, { id: string; courseId: string }>;
  matchIdsByDay: Map<1 | 2 | 3, { id: string; matchNumber: number }[]>;
  sideIdByMatchAndCode: Map<string, string>; // `${matchId}:${code}`
}

async function resolveSetupIds(): Promise<SetupIds> {
  const sb = supabaseAdmin();
  const [
    { data: tournaments },
    { data: teams },
    { data: players },
    { data: rounds },
    { data: tees },
    { data: matches },
    { data: sides },
  ] = await Promise.all([
    sb.from("tournaments").select("id, teams_locked"),
    sb.from("teams").select("id, code"),
    sb.from("players").select("id, slug, team_id"),
    sb.from("rounds").select("id, day_number, course_id"),
    sb.from("tees").select("id, slug, course_id"),
    sb.from("matches").select("id, slug, round_id, match_number"),
    sb.from("match_sides").select("id, match_id, side_code"),
  ]);
  const tournament = tournaments?.[0];
  if (!tournament) throw new Error("No tournament row found");

  const teamIdByCode = new Map((teams ?? []).map((t: any) => [t.code as TeamCode, t.id as string]));
  const teamCodeById = new Map((teams ?? []).map((t: any) => [t.id as string, t.code as TeamCode]));
  const playerIdBySlug = new Map((players ?? []).map((p: any) => [p.slug as string, p.id as string]));
  const playerTeamBySlug = new Map(
    (players ?? []).map((p: any) => [p.slug as string, teamCodeById.get(p.team_id) as TeamCode]),
  );
  const roundIdByDay = new Map(
    (rounds ?? []).map((r: any) => [r.day_number as 1 | 2 | 3, { id: r.id as string, courseId: r.course_id as string }]),
  );
  const teeIdBySlug = new Map(
    (tees ?? []).map((t: any) => [t.slug as string, { id: t.id as string, courseId: t.course_id as string }]),
  );
  const roundDayById = new Map((rounds ?? []).map((r: any) => [r.id as string, r.day_number as 1 | 2 | 3]));
  const matchIdsByDay = new Map<1 | 2 | 3, { id: string; matchNumber: number }[]>();
  for (const m of (matches ?? []) as any[]) {
    const day = roundDayById.get(m.round_id);
    if (day == null) continue;
    const list = matchIdsByDay.get(day) ?? [];
    list.push({ id: m.id, matchNumber: m.match_number });
    matchIdsByDay.set(day, list);
  }
  for (const list of matchIdsByDay.values()) list.sort((a, b) => a.matchNumber - b.matchNumber);

  const sideIdByMatchAndCode = new Map(
    (sides ?? []).map((s: any) => [`${s.match_id}:${s.side_code}`, s.id as string]),
  );

  return {
    tournamentId: tournament.id,
    teamsLocked: tournament.teams_locked,
    teamIdByCode,
    playerIdBySlug,
    playerTeamBySlug,
    roundIdByDay,
    teeIdBySlug,
    matchIdsByDay,
    sideIdByMatchAndCode,
  };
}

function revalidateForSetup() {
  revalidatePath("/teams");
  revalidatePath("/");
  revalidatePath("/players");
  revalidatePath("/players/[slug]", "page");
  revalidatePath("/score/[matchId]", "page");
  revalidatePath("/matches/[id]", "page");
  revalidatePath("/days/[n]", "page");
  revalidatePath("/admin");
}

async function assertNoScoresFor(matchIds: string[], table: "scores" | "scramble_scores", label: string) {
  const { data, error } = await supabaseAdmin().from(table).select("id").in("match_id", matchIds).limit(1);
  if (error) throw error;
  if ((data ?? []).length > 0) {
    throw new Error(`Cannot change pairings — scores have already been entered for ${label}`);
  }
}

export async function setPlayerTeam(input: { playerSlug: string; team: TeamCode | null }) {
  requireTeamsEditor();
  const team = validateTeamOrNull(input.team);
  const ids = await resolveSetupIds();
  if (ids.teamsLocked) throw new Error("Teams are locked — unlock to reassign");
  const playerId = ids.playerIdBySlug.get(input.playerSlug);
  if (!playerId) throw new Error("Unknown player");
  const teamId = team === null ? null : ids.teamIdByCode.get(team);
  if (team !== null && !teamId) throw new Error("Unknown team");
  const { error } = await supabaseAdmin().from("players").update({ team_id: teamId }).eq("id", playerId);
  if (error) throw error;
  revalidateForSetup();
}

export async function resetTeamAssignments() {
  requireTeamsEditor();
  const ids = await resolveSetupIds();
  if (ids.teamsLocked) throw new Error("Teams are locked — unlock to reassign");
  const { error } = await supabaseAdmin()
    .from("players").update({ team_id: null }).eq("tournament_id", ids.tournamentId);
  if (error) throw error;
  revalidateForSetup();
}

export async function updatePlayerName(input: { playerSlug: string; name: string }) {
  requireTeamsEditor();
  const name = validateName(input.name);
  const ids = await resolveSetupIds();
  const playerId = ids.playerIdBySlug.get(input.playerSlug);
  if (!playerId) throw new Error("Unknown player");
  const { error } = await supabaseAdmin().from("players").update({ name }).eq("id", playerId);
  if (error) throw error;
  revalidateForSetup();
}

export async function updatePlayerHandicap(input: { playerSlug: string; handicapIndex: number }) {
  requireTeamsEditor();
  const handicapIndex = validateHandicap(input.handicapIndex);
  const ids = await resolveSetupIds();
  const playerId = ids.playerIdBySlug.get(input.playerSlug);
  if (!playerId) throw new Error("Unknown player");
  const { error } = await supabaseAdmin().from("players").update({ handicap_index: handicapIndex }).eq("id", playerId);
  if (error) throw error;
  revalidateForSetup();
}

/** Set a single player's tee for a single day. Each golfer chooses independently. */
export async function setPlayerTee(input: { playerSlug: string; dayNumber: 1 | 2 | 3; teeSlug: string }) {
  requireTeamsEditor();
  const ids = await resolveSetupIds();
  const playerId = ids.playerIdBySlug.get(input.playerSlug);
  const round = ids.roundIdByDay.get(input.dayNumber);
  const tee = ids.teeIdBySlug.get(input.teeSlug);
  if (!playerId) throw new Error("Unknown player");
  if (!round) throw new Error("Unknown round");
  if (!tee) throw new Error("Unknown tee");
  if (tee.courseId !== round.courseId) throw new Error("Tee does not belong to this day's course");
  const { error } = await supabaseAdmin()
    .from("player_tee_selections")
    .upsert({ player_id: playerId, round_id: round.id, tee_id: tee.id }, { onConflict: "player_id,round_id" });
  if (error) throw error;
  revalidateForSetup();
}

export async function lockTeams() {
  requireTeamsEditor();
  const ids = await resolveSetupIds();
  const sb = supabaseAdmin();
  const { data: players, error } = await sb
    .from("players").select("id, team_id, sort_order").order("sort_order");
  if (error) throw error;
  const euId = ids.teamIdByCode.get("EU");
  const usaId = ids.teamIdByCode.get("USA");
  const euRoster = (players ?? []).filter((p: any) => p.team_id === euId);
  const usaRoster = (players ?? []).filter((p: any) => p.team_id === usaId);
  if (euRoster.length !== 4 || usaRoster.length !== 4) {
    throw new Error(`Each team must have exactly 4 players before locking (currently EU ${euRoster.length}, USA ${usaRoster.length})`);
  }

  // Pairings (match_players) may still reflect a stale roster from before
  // this team assignment — re-derive a default pairing from the roster
  // that's actually being locked in, so the pairing boards start correct
  // and later swaps validate against a roster that actually matches.
  const day1 = ids.matchIdsByDay.get(1) ?? [];
  const day2 = ids.matchIdsByDay.get(2) ?? [];
  const day3 = ids.matchIdsByDay.get(3) ?? [];
  const rows: { match_id: string; match_side_id: string; player_id: string; pairing_position: number }[] = [];

  function assignPairMatches(matches: { id: string }[], roster: { id: string }[], code: TeamCode) {
    matches.forEach((m, mi) => {
      const sideId = ids.sideIdByMatchAndCode.get(`${m.id}:${code}`);
      if (!sideId) throw new Error(`Missing ${code} side for match ${m.id}`);
      roster.slice(mi * 2, mi * 2 + 2).forEach((p, pos) => {
        rows.push({ match_id: m.id, match_side_id: sideId, player_id: p.id, pairing_position: pos + 1 });
      });
    });
  }
  assignPairMatches(day1, euRoster, "EU");
  assignPairMatches(day1, usaRoster, "USA");
  assignPairMatches(day2, euRoster, "EU");
  assignPairMatches(day2, usaRoster, "USA");
  day3.forEach((m, i) => {
    const euSideId = ids.sideIdByMatchAndCode.get(`${m.id}:EU`);
    const usaSideId = ids.sideIdByMatchAndCode.get(`${m.id}:USA`);
    if (!euSideId || !usaSideId) throw new Error(`Missing side for match ${m.id}`);
    rows.push({ match_id: m.id, match_side_id: euSideId, player_id: euRoster[i].id, pairing_position: 1 });
    rows.push({ match_id: m.id, match_side_id: usaSideId, player_id: usaRoster[i].id, pairing_position: 1 });
  });

  const matchIds = [...day1, ...day2, ...day3].map((m) => m.id);
  if (matchIds.length > 0) {
    const { error: delErr } = await sb.from("match_players").delete().in("match_id", matchIds);
    if (delErr) throw delErr;
    const { error: insErr } = await sb.from("match_players").insert(rows);
    if (insErr) throw insErr;
  }

  const { error: updErr } = await sb.from("tournaments").update({ teams_locked: true }).eq("id", ids.tournamentId);
  if (updErr) throw updErr;
  revalidateForSetup();
}

export async function unlockTeams() {
  requireTeamsEditor();
  const ids = await resolveSetupIds();
  const sb = supabaseAdmin();
  // Deliberately does NOT clear match_players. reshapeMatchRow() (in
  // tournamentData.ts) requires every match to have a complete set of
  // players per side — every page in the app calls loadMatches() through
  // buildScoringContext, so leaving a match with a partial/empty roster
  // (even briefly) would 500 the entire site, not just /teams. Existing
  // pairings are left in place (possibly stale re: current team assignment)
  // until explicitly overwritten via setDayPairings/setDaySingles, which
  // validates a full bijection against the current roster before writing.
  const { error } = await sb.from("tournaments").update({ teams_locked: false }).eq("id", ids.tournamentId);
  if (error) throw error;
  revalidateForSetup();
}

export async function setDayPairings(input: {
  dayNumber: 1 | 2;
  team: TeamCode;
  pairs: [[string, string], [string, string]];
}) {
  requireTeamsEditor();
  const team = validateTeam(input.team);
  const ids = await resolveSetupIds();
  if (!ids.teamsLocked) throw new Error("Lock teams before setting pairings");
  const matches = ids.matchIdsByDay.get(input.dayNumber);
  if (!matches || matches.length !== 2) throw new Error("Expected exactly 2 matches for this day");

  const rosterSlugs = [...ids.playerTeamBySlug.entries()].filter(([, t]) => t === team).map(([slug]) => slug);
  const flatPairs = input.pairs.flat();
  if (flatPairs.length !== 4 || new Set(flatPairs).size !== 4) {
    throw new Error("Pairs must contain 4 distinct players");
  }
  if (rosterSlugs.length !== 4 || !rosterSlugs.every((s) => flatPairs.includes(s))) {
    throw new Error("Pairs must exactly match this team's current 4-player roster");
  }

  const matchIds = matches.map((m) => m.id);
  await assertNoScoresFor(matchIds, input.dayNumber === 2 ? "scramble_scores" : "scores", `Day ${input.dayNumber}`);

  const sb = supabaseAdmin();
  for (let i = 0; i < 2; i++) {
    const match = matches[i];
    const sideId = ids.sideIdByMatchAndCode.get(`${match.id}:${team}`);
    if (!sideId) throw new Error(`Missing ${team} side for match ${match.id}`);
    const { error: delErr } = await sb
      .from("match_players")
      .delete()
      .eq("match_id", match.id)
      .eq("match_side_id", sideId);
    if (delErr) throw delErr;
    const rows = input.pairs[i].map((slug, pos) => ({
      match_id: match.id,
      match_side_id: sideId,
      player_id: ids.playerIdBySlug.get(slug)!,
      pairing_position: pos + 1,
    }));
    const { error: insErr } = await sb.from("match_players").insert(rows);
    if (insErr) throw insErr;
  }
  revalidateForSetup();
}

export async function setDaySingles(input: { pairs: { euPlayerSlug: string; usaPlayerSlug: string }[] }) {
  requireTeamsEditor();
  const ids = await resolveSetupIds();
  if (!ids.teamsLocked) throw new Error("Lock teams before setting pairings");
  if (input.pairs.length !== 4) throw new Error("Expected exactly 4 singles matchups");
  const matches = ids.matchIdsByDay.get(3);
  if (!matches || matches.length !== 4) throw new Error("Expected exactly 4 matches for Day 3");

  const euRoster = [...ids.playerTeamBySlug.entries()].filter(([, t]) => t === "EU").map(([slug]) => slug);
  const usaRoster = [...ids.playerTeamBySlug.entries()].filter(([, t]) => t === "USA").map(([slug]) => slug);
  const euSlugs = input.pairs.map((p) => p.euPlayerSlug);
  const usaSlugs = input.pairs.map((p) => p.usaPlayerSlug);
  if (new Set(euSlugs).size !== 4 || new Set(usaSlugs).size !== 4) {
    throw new Error("Each player can only appear once");
  }
  if (!euRoster.every((s) => euSlugs.includes(s)) || !usaRoster.every((s) => usaSlugs.includes(s))) {
    throw new Error("Pairs must exactly match the current 4-player rosters");
  }

  const matchIds = matches.map((m) => m.id);
  await assertNoScoresFor(matchIds, "scores", "Day 3");

  const sb = supabaseAdmin();
  for (let i = 0; i < 4; i++) {
    const match = matches[i];
    const euSideId = ids.sideIdByMatchAndCode.get(`${match.id}:EU`);
    const usaSideId = ids.sideIdByMatchAndCode.get(`${match.id}:USA`);
    if (!euSideId || !usaSideId) throw new Error(`Missing side for match ${match.id}`);
    const { error: delErr } = await sb.from("match_players").delete().eq("match_id", match.id);
    if (delErr) throw delErr;
    const { error: insErr } = await sb.from("match_players").insert([
      {
        match_id: match.id,
        match_side_id: euSideId,
        player_id: ids.playerIdBySlug.get(input.pairs[i].euPlayerSlug)!,
        pairing_position: 1,
      },
      {
        match_id: match.id,
        match_side_id: usaSideId,
        player_id: ids.playerIdBySlug.get(input.pairs[i].usaPlayerSlug)!,
        pairing_position: 1,
      },
    ]);
    if (insErr) throw insErr;
  }
  revalidateForSetup();
}
