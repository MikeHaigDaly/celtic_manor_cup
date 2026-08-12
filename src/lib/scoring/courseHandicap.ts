import type { ScrambleAllowance, Tee } from "@/lib/types";

/**
 * WHS-style Course Handicap.
 *
 *   CH = HI × (Slope / 113) + (Course Rating − Par)
 *
 * Rounded to the nearest whole number (0.5 rounds up). The value is used
 * by match play stroke allocation; it can be negative for very low HIs on
 * easy tees.
 */
export function calculateCourseHandicap(handicapIndex: number, tee: Tee): number {
  if (!Number.isFinite(handicapIndex)) throw new Error("Invalid Handicap Index");
  const slopeFactor = tee.slopeRating / 113;
  const raw = handicapIndex * slopeFactor + (tee.courseRating - tee.par);
  return Math.round(raw);
}

/**
 * Playing Handicap = Course Handicap × allowance%.
 * Handicap allowance is a competition-format setting (e.g. 100% singles,
 * 90% four-ball, 85% foursomes, custom scramble). Rounded to nearest int.
 *
 * Kept explicit and separate from CH so the three concepts don't collapse.
 */
export function calculatePlayingHandicap(
  courseHandicap: number,
  allowancePercent = 100,
): number {
  return Math.round(courseHandicap * (allowancePercent / 100));
}

/**
 * Match-play stroke allocation.
 *
 * Given every competitor's Playing Handicap, return each competitor's
 * *strokes received in the match* — i.e. the difference from the lowest
 * Playing Handicap in the field. The lowest player receives 0.
 *
 * Works for singles (2 inputs), fourball / pairs (4 inputs), or any N.
 * Negative playing handicaps (plus handicaps) are normalised via the same
 * subtract-min rule.
 */
export function matchStrokeAllocation(playingHandicaps: number[]): number[] {
  if (playingHandicaps.length === 0) return [];
  const min = Math.min(...playingHandicaps);
  return playingHandicaps.map((h) => Math.max(0, h - min));
}

/**
 * 2-man scramble Playing Handicap.
 *
 * Default allowance (USGA-style): 35% of the lower Course Handicap + 15% of
 * the higher. The `allowance` argument makes this rule explicit and
 * configurable rather than hard-coded.
 *
 * If `override` is supplied it wins — this preserves the ability to lock a
 * specific pair handicap from admin/config.
 */
export function calculateScramblePlayingHandicap(
  courseHandicapA: number,
  courseHandicapB: number,
  allowance: ScrambleAllowance = { low: 0.35, high: 0.15 },
  override?: number | null,
): number {
  if (override != null && Number.isFinite(override)) return Math.round(override);
  const low  = Math.min(courseHandicapA, courseHandicapB);
  const high = Math.max(courseHandicapA, courseHandicapB);
  return Math.round(low * allowance.low + high * allowance.high);
}

