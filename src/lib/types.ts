// Central type definitions used by scoring engine & UI. No React/Next imports.

export type TeamCode = "EU" | "USA";

export type RoundFormat = "DAY1_PAR_PAIRS" | "DAY2_SCRAMBLE" | "DAY3_SINGLES";

export interface Hole {
  number: number;       // 1..18
  par: 3 | 4 | 5;
  strokeIndex: number;  // 1..18
  yardage?: number;
}

/**
 * A set of tees on a course. `courseRating`/`slopeRating`/`par` are used by
 * the Course Handicap calculation. `totalYardage` is informational.
 */
export interface Tee {
  id: string;
  courseId: string;
  name: string;                 // e.g. "Yellow", "White"
  gender?: "MEN" | "WOMEN" | "MIXED";
  courseRating: number;         // e.g. 71.2
  slopeRating: number;          // 55..155
  par: number;                  // tee par
  totalYardage?: number;
  /** Per-hole yardage, index 0 = hole 1. Absent when data not yet supplied. */
  holeYardages?: number[];
}

export interface Course {
  id: string;
  name: string;
  holes: Hole[]; // length 18
  tees: Tee[];
}

export interface Player {
  id: string;          // stable slug e.g. "mike-daly"
  name: string;
  /** null until dragged onto EU or USA on the /teams setup board. */
  team: TeamCode | null;
  /** Locked underlying tournament Handicap Index (decimal, e.g. 10.7). */
  handicapIndex: number;
  photoUrl?: string;
}

// A single individual score for Day 1 / Day 3
export interface IndividualScore {
  matchId: string;
  playerId: string;
  holeNumber: number;
  gross: number;
}

// One score per pair per hole for Day 2
export interface ScrambleScore {
  matchId: string;
  side: TeamCode;
  holeNumber: number;
  gross: number;
}

// Match definitions (from config; persisted in DB)
export interface Day1Match {
  id: string;
  dayNumber: 1;
  format: "DAY1_PAR_PAIRS";
  matchNumber: number;
  courseId: string;
  euPlayers: [string, string]; // player ids
  usaPlayers: [string, string];
}
export interface Day2Match {
  id: string;
  dayNumber: 2;
  format: "DAY2_SCRAMBLE";
  matchNumber: number;
  courseId: string;
  euPlayers: [string, string];
  usaPlayers: [string, string];
  /** Optional manual override; if omitted, scramble PH is calculated from HI + tee + allowance. */
  euPairHandicap?: number;
  usaPairHandicap?: number;
}
export interface Day3Match {
  id: string;
  dayNumber: 3;
  format: "DAY3_SINGLES";
  matchNumber: number;
  courseId: string;
  euPlayer: string;
  usaPlayer: string;
}
export type AnyMatch = Day1Match | Day2Match | Day3Match;

// Per-hole result of a match play hole
export type HoleWinner = TeamCode | "HALVED" | "PENDING";

export interface HoleResult {
  hole: Hole;
  euScore: number | null; // net (or gross if gross mode) team/pair/singles score
  usaScore: number | null;
  winner: HoleWinner;
  // Optional details for UI
  detail?: Record<string, unknown>;
}

export type MatchStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "FINISHED";

export interface MatchState {
  matchId: string;
  status: MatchStatus;
  euHolesWon: number;
  usaHolesWon: number;
  holesHalved: number;
  holesCompleted: number;   // holes with a resolved winner (not PENDING)
  holesRemaining: number;   // 18 - holesCompleted
  leadTeam: TeamCode | null;
  leadAmount: number;       // absolute difference
  // e.g. "EU 2 UP", "USA 3&2", "HALVED", "AS", "NOT STARTED"
  statusText: string;
  finished: boolean;
  // Cup points: 1 / 0.5 / 0 per team (only when finished)
  euPoints: number;
  usaPoints: number;
  holeResults: HoleResult[]; // length 18, in hole order (may include PENDING)
  throughHole: number;       // the highest hole with a resolved result, else 0
}

export type ScoringMode = "NET" | "GROSS";

/** Per-day round settings — selected tee is stored at round level. */
export interface RoundSetting {
  dayNumber: 1 | 2 | 3;
  courseId: string;
  selectedTeeId: string;
  /** Independent of tournament-wide teams_locked — reveals this day's pairings on the leaderboard. */
  pairingsLocked: boolean;
}

/** Configurable 2-man scramble allowance (fractions, e.g. { low: 0.35, high: 0.15 }). */
export interface ScrambleAllowance {
  low: number;
  high: number;
}

