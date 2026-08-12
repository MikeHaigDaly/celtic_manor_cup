import { describe, it, expect } from "vitest";
import { getHandicapStrokes, calculateNetScore } from "@/lib/scoring/handicap";

describe("getHandicapStrokes", () => {
  it("hcp 8 gives 1 stroke on SI 1..8", () => {
    for (let si = 1; si <= 8; si++) expect(getHandicapStrokes(8, si)).toBe(1);
  });
  it("hcp 8 gives 0 strokes on SI 9..18", () => {
    for (let si = 9; si <= 18; si++) expect(getHandicapStrokes(8, si)).toBe(0);
  });
  it("hcp 18 gives 1 stroke on every hole", () => {
    for (let si = 1; si <= 18; si++) expect(getHandicapStrokes(18, si)).toBe(1);
  });
  it("hcp 20 gives 2 strokes on SI 1..2 and 1 elsewhere", () => {
    expect(getHandicapStrokes(20, 1)).toBe(2);
    expect(getHandicapStrokes(20, 2)).toBe(2);
    expect(getHandicapStrokes(20, 3)).toBe(1);
    expect(getHandicapStrokes(20, 18)).toBe(1);
  });
  it("hcp 0 or negative gives 0", () => {
    expect(getHandicapStrokes(0, 1)).toBe(0);
    expect(getHandicapStrokes(-5, 1)).toBe(0);
  });
  it("throws on invalid SI", () => {
    expect(() => getHandicapStrokes(10, 0)).toThrow();
    expect(() => getHandicapStrokes(10, 19)).toThrow();
  });
});

describe("calculateNetScore", () => {
  it("returns null when gross is missing", () => {
    expect(calculateNetScore(null, 1)).toBeNull();
  });
  it("subtracts handicap strokes", () => {
    expect(calculateNetScore(5, 1)).toBe(4);
    expect(calculateNetScore(6, 2)).toBe(4);
  });
});

