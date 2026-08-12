import { describe, it, expect } from "vitest";
import type { Hole, HoleResult, HoleWinner } from "@/lib/types";
import { calculateHoleWinner, calculateMatchState } from "@/lib/scoring/matchState";

const hole = (n: number): Hole => ({ number: n, par: 4, strokeIndex: n });

function makeResults(winners: (HoleWinner | undefined)[]): HoleResult[] {
  // Pad/fill to 18 with PENDING
  return Array.from({ length: 18 }, (_, i) => {
    const w = winners[i] ?? "PENDING";
    return {
      hole: hole(i + 1),
      euScore: w === "PENDING" ? null : 4,
      usaScore: w === "PENDING" ? null : 4,
      winner: w,
    };
  });
}

describe("calculateHoleWinner", () => {
  it("PENDING when either missing", () => {
    expect(calculateHoleWinner(null, 4)).toBe("PENDING");
    expect(calculateHoleWinner(4, null)).toBe("PENDING");
  });
  it("lower wins", () => {
    expect(calculateHoleWinner(3, 4)).toBe("EU");
    expect(calculateHoleWinner(5, 4)).toBe("USA");
    expect(calculateHoleWinner(4, 4)).toBe("HALVED");
  });
});

describe("calculateMatchState", () => {
  it("NOT STARTED when no holes played", () => {
    const s = calculateMatchState("m", makeResults([]));
    expect(s.statusText).toBe("NOT STARTED");
    expect(s.status).toBe("NOT_STARTED");
    expect(s.finished).toBe(false);
  });

  it("EU 1 UP after 1 hole", () => {
    const s = calculateMatchState("m", makeResults(["EU"]));
    expect(s.statusText).toBe("EU 1 UP");
    expect(s.throughHole).toBe(1);
    expect(s.finished).toBe(false);
  });

  it("AS when levelled", () => {
    const s = calculateMatchState("m", makeResults(["EU", "USA"]));
    expect(s.statusText).toBe("AS");
  });

  it("closes out 3&2: 3 UP with 2 remaining", () => {
    // After hole 16, EU wins 3 of the resolved holes and USA 0 out of 16 played.
    const w: HoleWinner[] = [
      "EU","HALVED","EU","HALVED","HALVED","HALVED","HALVED","HALVED",
      "HALVED","HALVED","HALVED","HALVED","HALVED","HALVED","HALVED","EU",
    ];
    const s = calculateMatchState("m", makeResults(w));
    expect(s.finished).toBe(true);
    expect(s.statusText).toBe("EU 3&2");
    expect(s.euPoints).toBe(1);
    expect(s.usaPoints).toBe(0);
  });

  it("2 UP with 2 remaining is NOT finished", () => {
    const w: HoleWinner[] = [
      "EU","EU","HALVED","HALVED","HALVED","HALVED","HALVED","HALVED",
      "HALVED","HALVED","HALVED","HALVED","HALVED","HALVED","HALVED","HALVED",
    ];
    const s = calculateMatchState("m", makeResults(w));
    expect(s.finished).toBe(false);
    expect(s.statusText).toBe("EU 2 UP");
  });

  it("HALVED after 18 all-square", () => {
    const w: HoleWinner[] = Array(18).fill("HALVED");
    const s = calculateMatchState("m", makeResults(w));
    expect(s.finished).toBe(true);
    expect(s.statusText).toBe("HALVED");
    expect(s.euPoints).toBe(0.5);
    expect(s.usaPoints).toBe(0.5);
  });

  it("closes on 18 as '1 UP'", () => {
    const w: HoleWinner[] = [
      ...Array(17).fill("HALVED") as HoleWinner[],
      "USA",
    ];
    const s = calculateMatchState("m", makeResults(w));
    expect(s.finished).toBe(true);
    expect(s.statusText).toBe("USA 1 UP");
    expect(s.usaPoints).toBe(1);
  });

  it("stops at first PENDING", () => {
    const w: HoleWinner[] = ["EU", "EU", "PENDING", "USA"];
    const s = calculateMatchState("m", makeResults(w));
    expect(s.holesCompleted).toBe(2);
    expect(s.throughHole).toBe(2);
    expect(s.statusText).toBe("EU 2 UP");
  });
});

