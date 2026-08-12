import type { Hole, ScoringMode } from "@/lib/types";
import { calculateNetScore, getHandicapStrokes } from "./handicap";

/** Day 3 singles — a single golfer's score on a hole. */
export function calculateDay3PlayerScore(
  hole: Hole,
  gross: number | null,
  handicap: number,
  mode: ScoringMode = "NET",
): number | null {
  if (gross == null) return null;
  if (mode === "GROSS") return gross;
  const strokes = getHandicapStrokes(handicap, hole.strokeIndex);
  return calculateNetScore(gross, strokes)!;
}

