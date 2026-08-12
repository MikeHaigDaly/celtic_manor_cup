import type { MatchState } from "@/lib/types";

export interface CupStandings {
  euPoints: number;
  usaPoints: number;
  decidedPoints: number;
  remainingPoints: number;
  totalPoints: number;
  /**
   *  null       → still in play
   *  "EU"|"USA" → mathematically clinched or won on final points
   *  "TIED"     → 4-4 after all matches decided
   */
  winner: "EU" | "USA" | "TIED" | null;
  status: string;
}

export function calculateCupStandings(
  matchStates: MatchState[],
  totalPoints = 8,
): CupStandings {
  let euPoints = 0;
  let usaPoints = 0;
  for (const m of matchStates) {
    if (m.finished) {
      euPoints += m.euPoints;
      usaPoints += m.usaPoints;
    }
  }
  const decidedPoints = matchStates.filter((m) => m.finished).length;
  const remainingPoints = totalPoints - decidedPoints;
  const clinch = totalPoints / 2; // need >4 to win outright

  let winner: CupStandings["winner"] = null;
  let status = `${decidedPoints} POINTS DECIDED · ${remainingPoints} REMAINING`;

  if (remainingPoints === 0) {
    if (euPoints > clinch) winner = "EU";
    else if (usaPoints > clinch) winner = "USA";
    else winner = "TIED"; // 4-4
    status =
      winner === "TIED"
        ? "CELTIC MANOR CUP TIED"
        : `${winner === "EU" ? "EUROPE" : "USA"} WINS CELTIC MANOR CUP`;
  } else {
    // Mathematical clinch mid-tournament
    if (euPoints > clinch) { winner = "EU"; status = "EUROPE CLINCH CELTIC MANOR CUP"; }
    else if (usaPoints > clinch) { winner = "USA"; status = "USA CLINCH CELTIC MANOR CUP"; }
  }

  return {
    euPoints,
    usaPoints,
    decidedPoints,
    remainingPoints,
    totalPoints,
    winner,
    status,
  };
}

