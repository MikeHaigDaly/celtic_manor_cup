// ─────────────────────────────────────────────────────────────────────────────
//  CELTIC MANOR CUP — TOURNAMENT CONFIGURATION
//  Single source of truth for tournament data. Change values here and re-seed.
//  Verified Celtic Manor men's tee ratings; hole-level data supplied where
//  confirmed. Missing hole-level yardages are left `undefined` and flagged.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  Course, Day1Match, Day2Match, Day3Match, Hole, Player,
  RoundSetting, ScrambleAllowance, Tee,
} from "@/lib/types";

// ── Tournament identity ────────────────────────────────────────────────────
export const TOURNAMENT = {
  name: "Celtic Manor Cup",
  subtitle: "Europe vs USA",
  year: 2026, // TODO: set the actual tournament year
};

// ── Players (fixed list) ────────────────────────────────────────────────
// `team` here only seeds a *new* player row (as unassigned — see seed.ts,
// which never overwrites an existing player's team/name/handicap, since
// those are live-edited from the /teams setup board from then on).
export const PLAYERS: Player[] = [
  { id: "mike-daly",         name: "Daly",   team: null, handicapIndex: 12.0 },
  { id: "lance-horstmann",   name: "Lance",  team: null, handicapIndex: 10.0 },
  { id: "michael-barnard",   name: "Barney", team: null, handicapIndex: 14.0 },
  { id: "chris-todd",        name: "Todd",   team: null, handicapIndex: 16.0 },
  { id: "jake-cowper",       name: "Jake",   team: null, handicapIndex:  8.0 },
  { id: "rob-paul",          name: "Rob",    team: null, handicapIndex: 18.0 },
  { id: "alex-summerfield",  name: "Alex",   team: null, handicapIndex: 11.0 },
  { id: "andrew-grant",      name: "Andy",   team: null, handicapIndex: 20.0 },
];

const H = (n: number, par: 3 | 4 | 5, si: number): Hole => ({ number: n, par, strokeIndex: si });

// ── TWENTY TEN (Day 1) ────────────────────────────────────────────────────
const TWENTY_TEN_HOLES: Hole[] = [
  H( 1, 4, 11), H( 2, 5,  3), H( 3, 3, 13), H( 4, 4, 15),
  H( 5, 4,  1), H( 6, 4,  7), H( 7, 3, 17), H( 8, 4,  9),
  H( 9, 5,  5), H(10, 3, 18), H(11, 5,  8), H(12, 4,  4),
  H(13, 3, 14), H(14, 4,  2), H(15, 4, 12), H(16, 4,  6),
  H(17, 3, 16), H(18, 5, 10),
]; // sum(par) = 71

const TWENTY_TEN_TEES: Tee[] = [
  { id: "twenty-ten-white",  courseId: "twenty-ten", name: "White",  gender: "MEN",
    courseRating: 74.6, slopeRating: 135, par: 71, totalYardage: 6961 },
  { id: "twenty-ten-yellow", courseId: "twenty-ten", name: "Yellow", gender: "MEN",
    courseRating: 72.5, slopeRating: 131, par: 71, totalYardage: 6539 },
  { id: "twenty-ten-red",    courseId: "twenty-ten", name: "Red",    gender: "MEN",
    courseRating: 68.3, slopeRating: 122, par: 71, totalYardage: 5654 },
  // TODO: per-hole yardages for all Twenty Ten tees (not yet verified)
];

// ── MONTGOMERIE (Day 2) ───────────────────────────────────────────────────
const MONTGOMERIE_HOLES: Hole[] = [
  H( 1, 4,  3), H( 2, 4, 13), H( 3, 4,  9), H( 4, 4,  7),
  H( 5, 3, 11), H( 6, 3, 15), H( 7, 4,  1), H( 8, 4, 17),
  H( 9, 4,  5), H(10, 4, 18), H(11, 3, 10), H(12, 5,  8),
  H(13, 3, 14), H(14, 4,  4), H(15, 3, 16), H(16, 4, 12),
  H(17, 4,  2), H(18, 5,  6),
]; // sum(par) = 69

const MONTGOMERIE_YELLOW_YARDAGES = [
  390, 390, 377, 334, 160, 145, 411, 273, 376,
  314, 178, 584, 145, 334, 151, 309, 386, 530,
]; // sum = 5787

const MONTGOMERIE_TEES: Tee[] = [
  { id: "montgomerie-white",  courseId: "montgomerie", name: "White",  gender: "MEN",
    courseRating: 70.5, slopeRating: 124, par: 69, totalYardage: 6196 },
  { id: "montgomerie-yellow", courseId: "montgomerie", name: "Yellow", gender: "MEN",
    courseRating: 68.2, slopeRating: 120, par: 69, totalYardage: 5787,
    holeYardages: MONTGOMERIE_YELLOW_YARDAGES },
  { id: "montgomerie-red",    courseId: "montgomerie", name: "Red",    gender: "MEN",
    courseRating: 64.7, slopeRating: 112, par: 69, totalYardage: 5051 },
];

// ── ROMAN ROAD (Day 3) ────────────────────────────────────────────────────
const ROMAN_ROAD_HOLES: Hole[] = [
  H( 1, 4,  5), H( 2, 5, 15), H( 3, 4,  7), H( 4, 3, 11),
  H( 5, 5,  1), H( 6, 4,  9), H( 7, 3, 13), H( 8, 4,  3),
  H( 9, 5, 17), H(10, 4,  8), H(11, 3,  6), H(12, 4, 14),
  H(13, 4,  2), H(14, 3, 16), H(15, 4,  4), H(16, 3, 18),
  H(17, 4, 10), H(18, 4, 12),
]; // sum(par) = 70

const ROMAN_ROAD_YELLOW_YARDAGES = [
  423, 468, 381, 180, 507, 288, 129, 428, 450,
  401, 186, 353, 420, 154, 355, 139, 321, 381,
]; // sum = 5964

const ROMAN_ROAD_TEES: Tee[] = [
  { id: "roman-road-white",  courseId: "roman-road", name: "White",  gender: "MEN",
    courseRating: 71.7, slopeRating: 129, par: 70, totalYardage: 6406 },
  { id: "roman-road-yellow", courseId: "roman-road", name: "Yellow", gender: "MEN",
    courseRating: 69.5, slopeRating: 123, par: 70, totalYardage: 5964,
    holeYardages: ROMAN_ROAD_YELLOW_YARDAGES },
  { id: "roman-road-red",    courseId: "roman-road", name: "Red",    gender: "MEN",
    courseRating: 66.0, slopeRating: 120, par: 70, totalYardage: 5193 },
];

export const COURSES: Course[] = [
  { id: "twenty-ten",  name: "Celtic Manor — Twenty Ten Course",  holes: TWENTY_TEN_HOLES,  tees: TWENTY_TEN_TEES  },
  { id: "montgomerie", name: "Celtic Manor — Montgomerie Course", holes: MONTGOMERIE_HOLES, tees: MONTGOMERIE_TEES },
  { id: "roman-road",  name: "Celtic Manor — Roman Road Course",  holes: ROMAN_ROAD_HOLES,  tees: ROMAN_ROAD_TEES  },
];

// ── Round settings (selected tee per day) ─────────────────────────────────
// `pairingsLocked` is live DB state (see tournamentData.loadRoundSettings),
// not seed config — this static list only ever feeds scripts/seed.ts.
export const ROUND_SETTINGS: Pick<RoundSetting, "dayNumber" | "courseId" | "selectedTeeId">[] = [
  { dayNumber: 1, courseId: "twenty-ten",  selectedTeeId: "twenty-ten-yellow"  },
  { dayNumber: 2, courseId: "montgomerie", selectedTeeId: "montgomerie-yellow" },
  { dayNumber: 3, courseId: "roman-road",  selectedTeeId: "roman-road-yellow"  },
];

// Handicap allowances (% of CH → PH). Day 1/3 strokes are each player's own
// PH applied directly by hole SI (no match-relative subtract-the-lowest).
export const HANDICAP_ALLOWANCES = { DAY1_PAR_PAIRS: 100, DAY3_SINGLES: 100 };

// 2-man scramble Playing Handicap: 35% low + 15% high (then match-relative).
export const SCRAMBLE_ALLOWANCE: ScrambleAllowance = { low: 0.35, high: 0.15 };

// ── Day 1 pairings ────────────────────────────────────────────────────────
export const DAY1_MATCHES: Day1Match[] = [
  { id: "d1m1", dayNumber: 1, format: "DAY1_PAR_PAIRS", matchNumber: 1, courseId: "twenty-ten",
    euPlayers: ["mike-daly", "lance-horstmann"], usaPlayers: ["jake-cowper", "rob-paul"] },
  { id: "d1m2", dayNumber: 1, format: "DAY1_PAR_PAIRS", matchNumber: 2, courseId: "twenty-ten",
    euPlayers: ["michael-barnard", "chris-todd"], usaPlayers: ["alex-summerfield", "andrew-grant"] },
];

// ── Day 2 pairings — pair PH auto-calculated. Overrides optional. ─────────
export const DAY2_MATCHES: Day2Match[] = [
  { id: "d2m1", dayNumber: 2, format: "DAY2_SCRAMBLE", matchNumber: 1, courseId: "montgomerie",
    euPlayers: ["mike-daly", "michael-barnard"], usaPlayers: ["jake-cowper", "alex-summerfield"] },
  { id: "d2m2", dayNumber: 2, format: "DAY2_SCRAMBLE", matchNumber: 2, courseId: "montgomerie",
    euPlayers: ["lance-horstmann", "chris-todd"], usaPlayers: ["rob-paul", "andrew-grant"] },
];

// ── Day 3 singles ─────────────────────────────────────────────────────────
export const DAY3_MATCHES: Day3Match[] = [
  { id: "d3m1", dayNumber: 3, format: "DAY3_SINGLES", matchNumber: 1, courseId: "roman-road", euPlayer: "mike-daly",       usaPlayer: "jake-cowper"      },
  { id: "d3m2", dayNumber: 3, format: "DAY3_SINGLES", matchNumber: 2, courseId: "roman-road", euPlayer: "lance-horstmann", usaPlayer: "rob-paul"         },
  { id: "d3m3", dayNumber: 3, format: "DAY3_SINGLES", matchNumber: 3, courseId: "roman-road", euPlayer: "michael-barnard", usaPlayer: "alex-summerfield" },
  { id: "d3m4", dayNumber: 3, format: "DAY3_SINGLES", matchNumber: 4, courseId: "roman-road", euPlayer: "chris-todd",      usaPlayer: "andrew-grant"     },
];

export const ALL_MATCHES = [...DAY1_MATCHES, ...DAY2_MATCHES, ...DAY3_MATCHES];

// Convenience lookups
export const playerById  = (id: string) => PLAYERS.find((p) => p.id === id);
export const courseById  = (id: string) => COURSES.find((c) => c.id === id);
export const matchById   = (id: string) => ALL_MATCHES.find((m) => m.id === id);
export const roundForDay = (n: 1 | 2 | 3) => ROUND_SETTINGS.find((r) => r.dayNumber === n)!;
export const teeById     = (id: string) => COURSES.flatMap((c) => c.tees).find((t) => t.id === id);

export const selectedTeeForMatch = (match: { dayNumber: 1 | 2 | 3 }): Tee => {
  const setting = roundForDay(match.dayNumber);
  const tee = teeById(setting.selectedTeeId);
  if (!tee) throw new Error(`Configured tee '${setting.selectedTeeId}' not found`);
  return tee;
};

export const TOTAL_CUP_POINTS = 8;

