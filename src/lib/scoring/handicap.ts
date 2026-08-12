/**
 * Handicap engine.
 *
 * Returns the number of strokes a player receives on a given hole for match play,
 * given their playing handicap and the hole's stroke index (1..18).
 *
 * Rules:
 *   - A playing handicap of N gives 1 stroke on the N holes with the lowest SI.
 *   - Handicaps > 18 wrap: e.g. handicap 20 → 1 stroke on every hole PLUS a
 *     second stroke on SI 1 and SI 2.
 *   - Negative handicaps clamp to 0.
 *
 * Examples:
 *   getHandicapStrokes(8, 1)  === 1
 *   getHandicapStrokes(8, 9)  === 0
 *   getHandicapStrokes(18, x) === 1 for every x
 *   getHandicapStrokes(20, 1) === 2
 *   getHandicapStrokes(20, 3) === 1
 */
export function getHandicapStrokes(
  playingHandicap: number,
  strokeIndex: number,
): number {
  if (!Number.isFinite(playingHandicap) || playingHandicap <= 0) return 0;
  if (!Number.isFinite(strokeIndex) || strokeIndex < 1 || strokeIndex > 18) {
    throw new Error(`Invalid strokeIndex: ${strokeIndex}`);
  }
  const hcp = Math.floor(playingHandicap);
  const base = Math.floor(hcp / 18);            // full rounds
  const extra = hcp % 18;                       // remaining strokes
  return base + (strokeIndex <= extra ? 1 : 0);
}

/**
 * netScore = grossScore - handicapStrokes.
 * Only used when a gross score exists; returns null otherwise.
 */
export function calculateNetScore(
  grossScore: number | null | undefined,
  handicapStrokes: number,
): number | null {
  if (grossScore == null) return null;
  return grossScore - handicapStrokes;
}

