import type { Hole, ScoringMode } from "@/lib/types";
import { calculateNetScore, getHandicapStrokes } from "./handicap";

export interface Day1PlayerInput {
  gross: number | null;
  handicap: number;
}

/**
 * Day 1 pair score for a single hole using BEST / WORST / BOTH rules
 * derived from the hole's PAR:
 *   par 3 → WORST net
 *   par 4 → BEST  net
 *   par 5 → BOTH  net (sum)
 *
 * Handicap strokes are applied INDIVIDUALLY first, then the par-specific
 * pair calculation runs on the two players' net (or gross in gross mode)
 * scores.
 *
 * Returns null if either player's score is missing.
 */
export function calculateDay1PairScore(
  hole: Hole,
  a: Day1PlayerInput,
  b: Day1PlayerInput,
  mode: ScoringMode = "NET",
): number | null {
  if (a.gross == null || b.gross == null) return null;

  const useNet = mode === "NET";
  const aStrokes = useNet ? getHandicapStrokes(a.handicap, hole.strokeIndex) : 0;
  const bStrokes = useNet ? getHandicapStrokes(b.handicap, hole.strokeIndex) : 0;

  const aScore = calculateNetScore(a.gross, aStrokes)!;
  const bScore = calculateNetScore(b.gross, bStrokes)!;

  switch (hole.par) {
    case 3: // WORST BALL
      return Math.max(aScore, bScore);
    case 4: // BEST BALL
      return Math.min(aScore, bScore);
    case 5: // BOTH SCORES (sum)
      return aScore + bScore;
    default: {
      // Should never occur; tightened by types.
      const _exhaust: never = hole.par;
      return _exhaust;
    }
  }
}

/** Human-readable rule label per par (used in UI). */
export function day1RuleLabel(par: 3 | 4 | 5): "WORST BALL" | "BEST BALL" | "BOTH SCORES" {
  return par === 3 ? "WORST BALL" : par === 4 ? "BEST BALL" : "BOTH SCORES";
}

