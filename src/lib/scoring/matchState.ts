import type { HoleResult, HoleWinner, MatchState, TeamCode } from "@/lib/types";

/**
 * Compare two side scores on a single hole. Both scores required to resolve.
 */
export function calculateHoleWinner(
  euScore: number | null,
  usaScore: number | null,
): HoleWinner {
  if (euScore == null || usaScore == null) return "PENDING";
  if (euScore < usaScore) return "EU";
  if (usaScore < euScore) return "USA";
  return "HALVED";
}

/**
 * Match-play engine. Given hole-by-hole resolved results (some may be PENDING),
 * derive full match state including automatic close-out (e.g. "EU 3&2").
 *
 * NOTE: `holeResults` must be in hole-number order (1..18).
 */
export function calculateMatchState(
  matchId: string,
  holeResults: HoleResult[],
): MatchState {
  if (holeResults.length !== 18) {
    // Defensive: pad or slice to 18 to prevent crashes; callers should pass 18.
    throw new Error(`calculateMatchState requires 18 hole results, got ${holeResults.length}`);
  }

  let euHolesWon = 0;
  let usaHolesWon = 0;
  let holesHalved = 0;
  let holesCompleted = 0;
  let finished = false;
  let finalDiff = 0;
  let finalLeader: TeamCode | null = null;
  let finalStatusText = "NOT STARTED";
  let throughHole = 0;

  for (let i = 0; i < 18; i++) {
    const hr = holeResults[i];
    if (hr.winner === "PENDING") break; // once we hit an unresolved hole, we stop counting sequentially

    holesCompleted++;
    throughHole = hr.hole.number;

    if (hr.winner === "EU") euHolesWon++;
    else if (hr.winner === "USA") usaHolesWon++;
    else holesHalved++;

    const diff = Math.abs(euHolesWon - usaHolesWon);
    const holesRemaining = 18 - holesCompleted;

    // Match is decided when the lead exceeds the number of remaining holes.
    if (diff > holesRemaining) {
      finished = true;
      finalDiff = diff;
      finalLeader = euHolesWon > usaHolesWon ? "EU" : "USA";
      // Close-out label: "X&Y" where X is diff, Y is holesRemaining.
      finalStatusText = holesRemaining === 0
        ? `${finalLeader} ${diff} UP`         // e.g. won on the 18th
        : `${finalLeader} ${diff}&${holesRemaining}`;
      break;
    }

    // If all 18 played and level → halved.
    if (holesCompleted === 18) {
      if (diff === 0) {
        finished = true;
        finalStatusText = "HALVED";
        finalLeader = null;
      } else {
        finished = true;
        finalDiff = diff;
        finalLeader = euHolesWon > usaHolesWon ? "EU" : "USA";
        finalStatusText = `${finalLeader} ${diff} UP`;
      }
    }
  }

  const diff = Math.abs(euHolesWon - usaHolesWon);
  const leader: TeamCode | null =
    euHolesWon === usaHolesWon ? null : euHolesWon > usaHolesWon ? "EU" : "USA";
  const holesRemaining = 18 - holesCompleted;

  let statusText: string;
  if (finished) {
    statusText = finalStatusText;
  } else if (holesCompleted === 0) {
    statusText = "NOT STARTED";
  } else if (diff === 0) {
    statusText = "AS";
  } else {
    statusText = `${leader} ${diff} UP`;
  }

  const status: MatchState["status"] = finished
    ? "FINISHED"
    : holesCompleted === 0
      ? "NOT_STARTED"
      : "IN_PROGRESS";

  // Cup points
  let euPoints = 0;
  let usaPoints = 0;
  if (finished) {
    if (finalLeader === "EU") euPoints = 1;
    else if (finalLeader === "USA") usaPoints = 1;
    else { euPoints = 0.5; usaPoints = 0.5; }
  }

  return {
    matchId,
    status,
    euHolesWon,
    usaHolesWon,
    holesHalved,
    holesCompleted,
    holesRemaining,
    leadTeam: leader,
    leadAmount: diff,
    statusText,
    finished,
    euPoints,
    usaPoints,
    holeResults,
    throughHole,
  };
}

