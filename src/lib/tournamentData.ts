/**
 * DB-backed reads for the tournament setup data that used to be static-only:
 * player team/handicap, per-round selected tee, and match pairings. Course/
 * hole/tee *structural* data (par, stroke index, ratings) stays config data —
 * these loaders only cover what's live-editable from the /teams page.
 */
import { cache } from "react";
import { teeById } from "@/config/tournament";
import { supabaseServer } from "./supabase/server";
import type { AnyMatch, Player, RoundSetting, TeamCode, Tee } from "./types";

export interface TournamentMeta {
  id: string;
  slug: string;
  name: string;
  year: number;
  teamsLocked: boolean;
}

export const loadTournamentMeta = cache(async (): Promise<TournamentMeta> => {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("tournaments")
    .select("id, slug, name, year, teams_locked")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    year: data.year,
    teamsLocked: data.teams_locked,
  };
});

export const loadPlayers = cache(async (): Promise<Player[]> => {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("players")
    .select("slug, name, handicap_index, photo_url, sort_order, teams:team_id(code)")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((r: any): Player => {
    // teams:team_id(...) comes back as an object for a to-one FK, but the
    // generated types treat it as possibly-array — normalize defensively.
    // team_id (and therefore this join) is null until assigned on /teams.
    const teamRow = Array.isArray(r.teams) ? r.teams[0] : r.teams;
    return {
      id: r.slug,
      name: r.name,
      team: (teamRow?.code ?? null) as TeamCode | null,
      // numeric(4,1) columns come back from PostgREST as strings.
      handicapIndex: Number(r.handicap_index),
      photoUrl: r.photo_url ?? undefined,
    };
  });
});

export const loadRoundSettings = cache(async (): Promise<RoundSetting[]> => {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("rounds")
    .select("day_number, courses:course_id(slug), tees:selected_tee_id(slug)")
    .order("day_number");
  if (error) throw error;
  return (data ?? []).map((r: any): RoundSetting => {
    const course = Array.isArray(r.courses) ? r.courses[0] : r.courses;
    const tee = Array.isArray(r.tees) ? r.tees[0] : r.tees;
    if (!tee) throw new Error(`Round ${r.day_number} has no selected tee`);
    return { dayNumber: r.day_number, courseId: course.slug, selectedTeeId: tee.slug };
  });
});

interface RawMatchPlayer {
  pairing_position: number;
  players: { slug: string } | { slug: string }[];
}
interface RawMatchSide {
  side_code: "EU" | "USA";
  pair_handicap_override: number | null;
  match_players: RawMatchPlayer[];
}
interface RawMatchRow {
  slug: string;
  match_number: number;
  rounds: { day_number: 1 | 2 | 3; format: string; courses: { slug: string } | { slug: string }[] }
    | { day_number: 1 | 2 | 3; format: string; courses: { slug: string } | { slug: string }[] }[];
  match_sides: RawMatchSide[];
}

const playerSlug = (mp: RawMatchPlayer): string => {
  const p = Array.isArray(mp.players) ? mp.players[0] : mp.players;
  return p.slug;
};

/** Pure reshaper: raw Supabase match row -> domain AnyMatch. Exported for unit tests. */
export function reshapeMatchRow(row: RawMatchRow): AnyMatch {
  const round = Array.isArray(row.rounds) ? row.rounds[0] : row.rounds;
  const course = Array.isArray(round.courses) ? round.courses[0] : round.courses;
  const euSide = row.match_sides.find((s) => s.side_code === "EU");
  const usaSide = row.match_sides.find((s) => s.side_code === "USA");
  if (!euSide || !usaSide) throw new Error(`Match ${row.slug} is missing a side`);

  const euPlayers = [...euSide.match_players]
    .sort((a, b) => a.pairing_position - b.pairing_position)
    .map(playerSlug);
  const usaPlayers = [...usaSide.match_players]
    .sort((a, b) => a.pairing_position - b.pairing_position)
    .map(playerSlug);

  const base = {
    id: row.slug,
    dayNumber: round.day_number,
    matchNumber: row.match_number,
    courseId: course.slug,
  };

  if (round.format === "DAY1_PAR_PAIRS") {
    if (euPlayers.length !== 2 || usaPlayers.length !== 2) {
      throw new Error(`Match ${row.slug} (DAY1_PAR_PAIRS) must have 2 players per side`);
    }
    return {
      ...base,
      dayNumber: 1,
      format: "DAY1_PAR_PAIRS",
      euPlayers: [euPlayers[0], euPlayers[1]],
      usaPlayers: [usaPlayers[0], usaPlayers[1]],
    };
  }
  if (round.format === "DAY2_SCRAMBLE") {
    if (euPlayers.length !== 2 || usaPlayers.length !== 2) {
      throw new Error(`Match ${row.slug} (DAY2_SCRAMBLE) must have 2 players per side`);
    }
    return {
      ...base,
      dayNumber: 2,
      format: "DAY2_SCRAMBLE",
      euPlayers: [euPlayers[0], euPlayers[1]],
      usaPlayers: [usaPlayers[0], usaPlayers[1]],
      euPairHandicap: euSide.pair_handicap_override ?? undefined,
      usaPairHandicap: usaSide.pair_handicap_override ?? undefined,
    };
  }
  if (round.format === "DAY3_SINGLES") {
    if (euPlayers.length !== 1 || usaPlayers.length !== 1) {
      throw new Error(`Match ${row.slug} (DAY3_SINGLES) must have 1 player per side`);
    }
    return {
      ...base,
      dayNumber: 3,
      format: "DAY3_SINGLES",
      euPlayer: euPlayers[0],
      usaPlayer: usaPlayers[0],
    };
  }
  throw new Error(`Unknown round format '${round.format}' for match ${row.slug}`);
}

export const loadMatches = cache(async (): Promise<AnyMatch[]> => {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("matches")
    .select(
      "slug, match_number, rounds:round_id(day_number, format, courses:course_id(slug)), " +
        "match_sides(side_code, pair_handicap_override, match_players(pairing_position, players:player_id(slug)))",
    )
    .order("match_number");
  if (error) throw error;
  return (data ?? []).map((r) => reshapeMatchRow(r as unknown as RawMatchRow));
});

/**
 * DB-driven replacement for config's `selectedTeeForMatch`. Tee structural
 * data (rating/slope/par) still comes from static COURSES — only *which*
 * tee slug is selected is live/DB-driven. Used as the fallback when a
 * player has no explicit per-player tee selection.
 */
export function teeForMatchFromSettings(
  match: { dayNumber: 1 | 2 | 3 },
  roundSettings: RoundSetting[],
): Tee {
  const setting = roundSettings.find((r) => r.dayNumber === match.dayNumber);
  if (!setting) throw new Error(`No round settings for day ${match.dayNumber}`);
  const tee = teeById(setting.selectedTeeId);
  if (!tee) throw new Error(`Configured tee '${setting.selectedTeeId}' not found`);
  return tee;
}

/** Each player's chosen tee per day, keyed `${playerSlug}:${dayNumber}` -> tee slug. */
export const loadPlayerTeeSelections = cache(async (): Promise<Map<string, string>> => {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("player_tee_selections")
    .select("players:player_id(slug), rounds:round_id(day_number), tees:tee_id(slug)");
  if (error) throw error;
  const map = new Map<string, string>();
  for (const r of (data ?? []) as any[]) {
    const player = Array.isArray(r.players) ? r.players[0] : r.players;
    const round = Array.isArray(r.rounds) ? r.rounds[0] : r.rounds;
    const tee = Array.isArray(r.tees) ? r.tees[0] : r.tees;
    map.set(`${player.slug}:${round.day_number}`, tee.slug);
  }
  return map;
});

/**
 * Resolve the Tee a specific player is using for a match's round: their own
 * selection if one exists, else the round's default tee.
 */
export function teeForPlayerFromSelections(
  match: { dayNumber: 1 | 2 | 3 },
  playerId: string,
  selections: Map<string, string>,
  roundSettings: RoundSetting[],
): Tee {
  const teeSlug = selections.get(`${playerId}:${match.dayNumber}`);
  const tee = teeSlug ? teeById(teeSlug) : undefined;
  if (tee) return tee;
  return teeForMatchFromSettings(match, roundSettings);
}
