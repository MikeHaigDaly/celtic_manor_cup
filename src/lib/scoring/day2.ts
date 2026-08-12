import type { Hole, ScoringMode } from "@/lib/types";
import { calculateNetScore, getHandicapStrokes } from "./handicap";

/**
 * Day 2 scramble: ONE team gross score per hole, with a configured pair
 * handicap. The pair receives strokes as if a single player of that handicap.
 */
export function calculateDay2SideNet(
  hole: Hole,
  teamGross: number | null,
  pairHandicap: number,
  mode: ScoringMode = "NET",
): number | null {
  if (teamGross == null) return null;
  if (mode === "GROSS") return teamGross;
  const strokes = getHandicapStrokes(pairHandicap, hole.strokeIndex);
  return calculateNetScore(teamGross, strokes)!;
}

