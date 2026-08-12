import type { Course, Tee } from "@/lib/types";

/**
 * Validate a course's holes and (per-supplied-tee) yardages.
 * Throws with a clear message when any invariant fails.
 *
 * Invariants:
 *   - exactly 18 holes numbered 1..18
 *   - stroke indices are exactly the set {1..18} (no duplicates)
 *   - sum(hole.par) === tee.par for every tee on the course
 *   - if tee.holeYardages is supplied → 18 numbers, and sum === tee.totalYardage
 *     (when totalYardage is also supplied)
 */
export function validateCourse(course: Course): void {
  const label = `Course '${course.id}'`;

  if (course.holes.length !== 18) {
    throw new Error(`${label}: expected 18 holes, got ${course.holes.length}`);
  }

  // Hole numbers 1..18
  const nums = course.holes.map((h) => h.number).sort((a, b) => a - b);
  for (let i = 0; i < 18; i++) {
    if (nums[i] !== i + 1) throw new Error(`${label}: hole numbers must be 1..18`);
  }

  // Stroke indices = set {1..18}
  const sis = course.holes.map((h) => h.strokeIndex).sort((a, b) => a - b);
  for (let i = 0; i < 18; i++) {
    if (sis[i] !== i + 1) {
      throw new Error(`${label}: stroke indices must be exactly 1..18 with no duplicates (got ${sis.join(",")})`);
    }
  }

  const sumPar = course.holes.reduce((s, h) => s + h.par, 0);

  for (const tee of course.tees) validateTee(course, tee, sumPar);
}

function validateTee(course: Course, tee: Tee, sumPar: number): void {
  const label = `Tee '${tee.id}'`;
  if (tee.par !== sumPar) {
    throw new Error(`${label}: tee.par (${tee.par}) does not match sum of hole pars (${sumPar}) on ${course.name}`);
  }
  if (tee.slopeRating < 55 || tee.slopeRating > 155) {
    throw new Error(`${label}: slopeRating ${tee.slopeRating} out of range 55..155`);
  }
  if (tee.courseRating <= 50 || tee.courseRating >= 90) {
    throw new Error(`${label}: courseRating ${tee.courseRating} looks wrong`);
  }
  if (tee.holeYardages) {
    if (tee.holeYardages.length !== 18) {
      throw new Error(`${label}: holeYardages must have 18 entries`);
    }
    if (tee.holeYardages.some((y) => !Number.isFinite(y) || y <= 0)) {
      throw new Error(`${label}: holeYardages must be positive numbers`);
    }
    if (tee.totalYardage != null) {
      const sum = tee.holeYardages.reduce((s, y) => s + y, 0);
      if (sum !== tee.totalYardage) {
        throw new Error(`${label}: sum of holeYardages (${sum}) does not reconcile to totalYardage (${tee.totalYardage})`);
      }
    }
  }
}

/** Validate every configured course; throws on the first failure. */
export function validateAllCourses(courses: Course[]): void {
  for (const c of courses) validateCourse(c);
}

