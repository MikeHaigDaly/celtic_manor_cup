import { describe, it, expect } from "vitest";
import type { Tee } from "@/lib/types";
import {
  calculateCourseHandicap,
  calculatePlayingHandicap,
  matchStrokeAllocation,
  calculateScramblePlayingHandicap,
} from "@/lib/scoring/courseHandicap";

// Verified Celtic Manor men's tees
const TWENTY_TEN_YELLOW: Tee = {
  id: "twenty-ten-yellow", courseId: "twenty-ten", name: "Yellow",
  courseRating: 72.5, slopeRating: 131, par: 71,
};
const MONTGOMERIE_YELLOW: Tee = {
  id: "montgomerie-yellow", courseId: "montgomerie", name: "Yellow",
  courseRating: 68.2, slopeRating: 120, par: 69,
};
const ROMAN_ROAD_YELLOW: Tee = {
  id: "roman-road-yellow", courseId: "roman-road", name: "Yellow",
  courseRating: 69.5, slopeRating: 123, par: 70,
};
const TWENTY_TEN_WHITE: Tee = {
  ...TWENTY_TEN_YELLOW, id: "twenty-ten-white", name: "White",
  courseRating: 74.6, slopeRating: 135, par: 71,
};

describe("calculateCourseHandicap — Celtic Manor verified tees", () => {
  // Formula: CH = round( HI × Slope/113 + (CR − Par) )
  //
  // Hand-computed reference values (single source: the formula above):
  //  HI 8.0  Twenty Ten Yellow  → 8*131/113 + 1.5 = 9.273 + 1.5 = 10.77 → 11
  //  HI 8.0  Twenty Ten White   → 8*135/113 + 3.6 = 9.558 + 3.6 = 13.16 → 13
  //  HI 8.0  Montgomerie Yellow → 8*120/113 - 0.8 = 8.495 - 0.8 =  7.70 →  8
  //  HI 8.0  Roman Road Yellow  → 8*123/113 - 0.5 = 8.708 - 0.5 =  8.21 →  8
  //  HI 16.1 Twenty Ten Yellow  → 16.1*131/113 + 1.5 = 18.663 + 1.5 = 20.16 → 20
  //  HI 20.0 Montgomerie Yellow → 20*120/113 - 0.8 = 21.239 - 0.8 = 20.44 → 20
  it("HI 8.0 on Twenty Ten Yellow rounds to 11", () => {
    expect(calculateCourseHandicap(8.0, TWENTY_TEN_YELLOW)).toBe(11);
  });
  it("HI 8.0 on Twenty Ten White rounds to 13", () => {
    expect(calculateCourseHandicap(8.0, TWENTY_TEN_WHITE)).toBe(13);
  });
  it("HI 8.0 on Montgomerie Yellow rounds to 8", () => {
    expect(calculateCourseHandicap(8.0, MONTGOMERIE_YELLOW)).toBe(8);
  });
  it("HI 8.0 on Roman Road Yellow rounds to 8", () => {
    expect(calculateCourseHandicap(8.0, ROMAN_ROAD_YELLOW)).toBe(8);
  });
  it("HI 16.1 on Twenty Ten Yellow rounds to 20", () => {
    expect(calculateCourseHandicap(16.1, TWENTY_TEN_YELLOW)).toBe(20);
  });
  it("HI 20.0 on Montgomerie Yellow rounds to 20", () => {
    expect(calculateCourseHandicap(20.0, MONTGOMERIE_YELLOW)).toBe(20);
  });
  it("Same HI produces DIFFERENT CH on Twenty Ten Yellow vs Montgomerie Yellow", () => {
    const y = calculateCourseHandicap(12.4, TWENTY_TEN_YELLOW);
    const m = calculateCourseHandicap(12.4, MONTGOMERIE_YELLOW);
    expect(y).not.toBe(m);
    expect(y).toBeGreaterThan(m); // Twenty Ten yellow is tougher
  });
  it("Same HI produces DIFFERENT CH on Twenty Ten Yellow vs Twenty Ten White", () => {
    const y = calculateCourseHandicap(12.4, TWENTY_TEN_YELLOW);
    const w = calculateCourseHandicap(12.4, TWENTY_TEN_WHITE);
    expect(w).toBeGreaterThan(y);
  });
  it("Handicap Index is not mutated by a CH calculation", () => {
    const hi = 12.4;
    calculateCourseHandicap(hi, TWENTY_TEN_WHITE);
    expect(hi).toBe(12.4);
  });
});

describe("calculatePlayingHandicap", () => {
  it("100% is identity (rounded)", () => {
    expect(calculatePlayingHandicap(20, 100)).toBe(20);
  });
  it("85% four-ball allowance rounds correctly", () => {
    expect(calculatePlayingHandicap(20, 85)).toBe(17);
  });
});

describe("matchStrokeAllocation — subtract lowest", () => {
  it("Day 1 four-player: 8/12/14/18 → 0/4/6/10", () => {
    expect(matchStrokeAllocation([8, 12, 14, 18])).toEqual([0, 4, 6, 10]);
  });
  it("Day 3 singles: 8/14 → 0/6", () => {
    expect(matchStrokeAllocation([8, 14])).toEqual([0, 6]);
  });
  it("Day 2 pair PH 6/10 → 0/4", () => {
    expect(matchStrokeAllocation([6, 10])).toEqual([0, 4]);
  });
  it("ties produce zero for both", () => {
    expect(matchStrokeAllocation([10, 10])).toEqual([0, 0]);
  });
});

describe("calculateScramblePlayingHandicap — 35% low + 15% high", () => {
  it("CH 8 + CH 22 → 6 (35%*8 + 15%*22 = 6.1)", () => {
    expect(calculateScramblePlayingHandicap(8, 22)).toBe(6);
  });
  it("order of arguments does not matter", () => {
    expect(calculateScramblePlayingHandicap(22, 8)).toBe(6);
  });
  it("override wins", () => {
    expect(calculateScramblePlayingHandicap(8, 22, { low: 0.35, high: 0.15 }, 9)).toBe(9);
  });
  it("custom allowance rule", () => {
    // 50% low + 20% high: 10 & 20 → 5 + 4 = 9
    expect(calculateScramblePlayingHandicap(10, 20, { low: 0.5, high: 0.2 })).toBe(9);
  });
});

