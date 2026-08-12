import { describe, it, expect } from "vitest";
import type { MatchState } from "@/lib/types";
import { calculateCupStandings } from "@/lib/scoring/cup";

const finished = (eu: number, usa: number): MatchState => ({
  matchId: Math.random().toString(),
  status: "FINISHED",
  euHolesWon: 0, usaHolesWon: 0, holesHalved: 0, holesCompleted: 18,
  holesRemaining: 0, leadTeam: null, leadAmount: 0,
  statusText: "FINISHED", finished: true, euPoints: eu, usaPoints: usa,
  holeResults: [], throughHole: 18,
});
const open = (): MatchState => ({
  matchId: Math.random().toString(),
  status: "IN_PROGRESS",
  euHolesWon: 0, usaHolesWon: 0, holesHalved: 0, holesCompleted: 3,
  holesRemaining: 15, leadTeam: "EU", leadAmount: 1, statusText: "EU 1 UP",
  finished: false, euPoints: 0, usaPoints: 0, holeResults: [], throughHole: 3,
});

describe("cup standings", () => {
  it("sums only finished matches", () => {
    const s = calculateCupStandings([
      finished(1, 0),
      finished(0.5, 0.5),
      open(),
    ]);
    expect(s.euPoints).toBe(1.5);
    expect(s.usaPoints).toBe(0.5);
    expect(s.decidedPoints).toBe(2);
    expect(s.remainingPoints).toBe(6);
    expect(s.winner).toBeNull();
  });

  it("declares 4-4 tie after all matches decided", () => {
    const matches: MatchState[] = [
      finished(1, 0), finished(1, 0), finished(1, 0), finished(1, 0),
      finished(0, 1), finished(0, 1), finished(0, 1), finished(0, 1),
    ];
    const s = calculateCupStandings(matches);
    expect(s.euPoints).toBe(4);
    expect(s.usaPoints).toBe(4);
    expect(s.winner).toBe("TIED");
  });

  it("clinches when a team crosses 4 with matches remaining", () => {
    const decided = [
      finished(1, 0), finished(1, 0), finished(1, 0), finished(1, 0), finished(1, 0),
    ];
    const s = calculateCupStandings([...decided, open(), open(), open()]);
    expect(s.euPoints).toBe(5);
    expect(s.winner).toBe("EU");
  });
});

