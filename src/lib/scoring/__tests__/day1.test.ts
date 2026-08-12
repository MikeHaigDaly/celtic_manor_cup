import { describe, it, expect } from "vitest";
import { calculateDay1PairScore } from "@/lib/scoring/day1";
import type { Hole } from "@/lib/types";

// Use SI so that no player receives a handicap stroke for the base tests
// (SI 18 with hcp 0 → 0 strokes).
const par3: Hole = { number: 1, par: 3, strokeIndex: 18 };
const par4: Hole = { number: 2, par: 4, strokeIndex: 18 };
const par5: Hole = { number: 3, par: 5, strokeIndex: 18 };

describe("Day 1 pair scoring", () => {
  it("Par 3 uses WORST net", () => {
    // Europe 3,5 → 5; USA 4,4 → 4 (USA wins)
    expect(calculateDay1PairScore(par3, { gross: 3, handicap: 0 }, { gross: 5, handicap: 0 })).toBe(5);
    expect(calculateDay1PairScore(par3, { gross: 4, handicap: 0 }, { gross: 4, handicap: 0 })).toBe(4);
  });

  it("Par 4 uses BEST net", () => {
    // Europe 4,6 → 4; USA 5,5 → 5 (Europe wins)
    expect(calculateDay1PairScore(par4, { gross: 4, handicap: 0 }, { gross: 6, handicap: 0 })).toBe(4);
    expect(calculateDay1PairScore(par4, { gross: 5, handicap: 0 }, { gross: 5, handicap: 0 })).toBe(5);
  });

  it("Par 5 uses BOTH (sum)", () => {
    // Europe 5,6 → 11; USA 5,5 → 10 (USA wins)
    expect(calculateDay1PairScore(par5, { gross: 5, handicap: 0 }, { gross: 6, handicap: 0 })).toBe(11);
    expect(calculateDay1PairScore(par5, { gross: 5, handicap: 0 }, { gross: 5, handicap: 0 })).toBe(10);
  });

  it("returns null if any score missing", () => {
    expect(calculateDay1PairScore(par4, { gross: null, handicap: 0 }, { gross: 5, handicap: 0 })).toBeNull();
  });

  it("applies handicap BEFORE the pair calculation on a par-4 (best ball)", () => {
    // Player A gross 5 with 1 stroke → net 4 wins.
    const hole: Hole = { number: 5, par: 4, strokeIndex: 1 };
    // A hcp 8 → 1 stroke on SI 1. B hcp 0.
    // Europe: A 5→4, B 6→6, best = 4.
    // USA:    5,5, best = 5. Europe wins.
    const eu = calculateDay1PairScore(hole, { gross: 5, handicap: 8 }, { gross: 6, handicap: 0 });
    const usa = calculateDay1PairScore(hole, { gross: 5, handicap: 0 }, { gross: 5, handicap: 0 });
    expect(eu).toBe(4);
    expect(usa).toBe(5);
  });

  it("GROSS mode ignores handicap strokes", () => {
    const hole: Hole = { number: 5, par: 4, strokeIndex: 1 };
    const grossEu = calculateDay1PairScore(hole, { gross: 5, handicap: 8 }, { gross: 6, handicap: 0 }, "GROSS");
    expect(grossEu).toBe(5); // BEST gross
  });
});

