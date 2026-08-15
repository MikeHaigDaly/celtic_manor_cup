/**
 * Traditional scorecard marks — relative to gross-to-par for a single hole,
 * never net (net already folds in handicap strokes, so marking it too would
 * double up on the same signal and read as contradictory).
 */
export type ScoreMarkKind = "eagle" | "birdie" | "bogey" | "double";

export function scoreMarkKind(gross: number | null | undefined, par: number): ScoreMarkKind | null {
  if (gross == null) return null;
  const diff = gross - par;
  if (diff <= -2) return "eagle";
  if (diff === -1) return "birdie";
  if (diff === 1) return "bogey";
  if (diff >= 2) return "double";
  return null; // par — no mark
}
