import { describe, it, expect } from "vitest";
import type { Course, Hole } from "@/lib/types";
import { validateCourse, validateAllCourses } from "@/lib/config/validate";
import { COURSES } from "@/config/tournament";

const goodHoles: Hole[] = Array.from({ length: 18 }, (_, i) => ({
  number: i + 1, par: (i % 3 === 0 ? 4 : i % 3 === 1 ? 3 : 5) as 3 | 4 | 5, strokeIndex: i + 1,
}));
// sum(pars) for the pattern above: with 18 holes the pars are 4,3,5 repeating, sum = (4+3+5)*6 = 72.
const goodCourse = (): Course => ({
  id: "t", name: "Test",
  holes: goodHoles,
  tees: [{ id: "t-y", courseId: "t", name: "Yellow", courseRating: 70.0, slopeRating: 120, par: 72 }],
});

describe("validateCourse", () => {
  it("passes a valid course", () => {
    expect(() => validateCourse(goodCourse())).not.toThrow();
  });
  it("rejects course without 18 holes", () => {
    const c = goodCourse();
    c.holes = c.holes.slice(0, 17);
    expect(() => validateCourse(c)).toThrow(/18 holes/);
  });
  it("rejects duplicate stroke indexes", () => {
    const c = goodCourse();
    c.holes = c.holes.map((h, i) => ({ ...h, strokeIndex: i === 0 ? 2 : h.strokeIndex }));
    expect(() => validateCourse(c)).toThrow(/stroke indices/);
  });
  it("rejects tee.par mismatch with sum of hole pars", () => {
    const c = goodCourse();
    c.tees = [{ ...c.tees[0], par: 71 }]; // real sum is 72
    expect(() => validateCourse(c)).toThrow(/tee.par/);
  });
  it("rejects hole yardage sum ≠ tee totalYardage when yardages provided", () => {
    const c = goodCourse();
    c.tees = [{
      ...c.tees[0],
      totalYardage: 6000,
      holeYardages: Array.from({ length: 18 }, () => 300), // sum = 5400
    }];
    expect(() => validateCourse(c)).toThrow(/does not reconcile/);
  });
});

describe("Celtic Manor courses validate against verified data", () => {
  it("all three configured courses are valid", () => {
    expect(() => validateAllCourses(COURSES)).not.toThrow();
  });

  it("Montgomerie Yellow yardages sum to 5787", () => {
    const monty = COURSES.find((c) => c.id === "montgomerie")!;
    const yellow = monty.tees.find((t) => t.name === "Yellow")!;
    expect(yellow.holeYardages!.reduce((s, y) => s + y, 0)).toBe(5787);
    expect(yellow.totalYardage).toBe(5787);
  });

  it("Roman Road Yellow yardages sum to 5964", () => {
    const rr = COURSES.find((c) => c.id === "roman-road")!;
    const yellow = rr.tees.find((t) => t.name === "Yellow")!;
    expect(yellow.holeYardages!.reduce((s, y) => s + y, 0)).toBe(5964);
    expect(yellow.totalYardage).toBe(5964);
  });

  it("Twenty Ten par sequence sums to 71", () => {
    const t10 = COURSES.find((c) => c.id === "twenty-ten")!;
    expect(t10.holes.reduce((s, h) => s + h.par, 0)).toBe(71);
  });
});

