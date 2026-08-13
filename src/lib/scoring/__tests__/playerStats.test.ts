import { describe, it, expect } from "vitest";
import type { Course, Day3Match, IndividualScore, Player, Tee } from "@/lib/types";
import { calculatePlayerStats } from "@/lib/scoring/playerStats";

// Neutral tee: CH === HI (slope 113, cr = par) so 0 HI → 0 strokes everywhere.
const neutralTee: Tee = { id: "neutral", courseId: "c", name: "Neutral", courseRating: 71, slopeRating: 113, par: 72 };
const holes = Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4 as const, strokeIndex: i + 1 }));
const course: Course = { id: "c", name: "Test", holes, tees: [neutralTee] };

describe("Individual stats keep counting after the team match closes out early", () => {
  const match: Day3Match = {
    id: "d3x", dayNumber: 3, format: "DAY3_SINGLES", matchNumber: 1, courseId: "c",
    euPlayer: "eu", usaPlayer: "us",
  };
  const players: Player[] = [
    { id: "eu", name: "eu", team: "EU", handicapIndex: 0 },
    { id: "us", name: "us", team: "USA", handicapIndex: 0 },
  ];

  // EU wins holes 1-10 outright (10-0) → diff 10 > 8 remaining → match closes
  // out at hole 10 ("10 & 8"). Holes 17-18 are then played out afterward
  // (group keeps playing) and locked once entered.
  const scores: IndividualScore[] = [
    ...Array.from({ length: 10 }, (_, i) => i + 1).flatMap((h) => [
      { matchId: "d3x", playerId: "eu", holeNumber: h, gross: 3 },
      { matchId: "d3x", playerId: "us", holeNumber: h, gross: 5 },
    ]),
    { matchId: "d3x", playerId: "eu", holeNumber: 17, gross: 4 },
    { matchId: "d3x", playerId: "us", holeNumber: 17, gross: 6 },
    { matchId: "d3x", playerId: "eu", holeNumber: 18, gross: 5 },
    { matchId: "d3x", playerId: "us", holeNumber: 18, gross: 4 },
  ];

  const lockedHolesByMatch = new Map<string, Set<number>>([
    ["d3x", new Set([1,2,3,4,5,6,7,8,9,10, 17, 18])],
  ]);

  const ctx = {
    players,
    matches: [match],
    courses: [course],
    individualScores: scores,
    scrambleScores: [],
    getTeeForMatch: () => neutralTee,
    lockedHolesByMatch,
  };

  it("team win/loss and cup points freeze at the close-out hole", () => {
    const stats = calculatePlayerStats("eu", ctx);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(0);
    expect(stats.cupPointsContributed).toBe(1);
  });

  it("per-hole W/L still reflects every locked hole, including ones played after close-out", () => {
    const stats = calculatePlayerStats("eu", ctx);
    // Holes 1-10 (won) + hole 17 (won) + hole 18 (lost, gross 5 vs US gross 4).
    expect(stats.holesWon).toBe(11);
    expect(stats.holesLost).toBe(1);
  });

  it("individual stroke stats include holes played after the match was decided", () => {
    const stats = calculatePlayerStats("eu", ctx);
    // 10 holes at gross 3 (par 4) + hole 17 gross 4 (par 4) + hole 18 gross 5 (par 4)
    // = 12 holes counted, not just the 10 that decided the match.
    const expectedGrossToPar = (3 - 4) * 10 + (4 - 4) + (5 - 4);
    expect(stats.individualGrossToPar).toBe(expectedGrossToPar);
  });

  it("a hole entered but not locked does not count toward individual stats", () => {
    const ctxWithUnlockedHole = {
      ...ctx,
      individualScores: [
        ...scores,
        { matchId: "d3x", playerId: "eu", holeNumber: 11, gross: 2 },
        { matchId: "d3x", playerId: "us", holeNumber: 11, gross: 2 },
      ],
      // hole 11 intentionally left out of lockedHolesByMatch
    };
    const stats = calculatePlayerStats("eu", ctxWithUnlockedHole);
    const expectedGrossToPar = (3 - 4) * 10 + (4 - 4) + (5 - 4); // unchanged — hole 11 excluded
    expect(stats.individualGrossToPar).toBe(expectedGrossToPar);
  });
});
