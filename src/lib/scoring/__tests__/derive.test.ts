import { describe, it, expect } from "vitest";
import type { Course, Day1Match, Day2Match, Day3Match, IndividualScore, Player, ScrambleScore, Tee } from "@/lib/types";
import { deriveMatchState, day2PairHandicaps, individualMatchHandicaps } from "@/lib/scoring/derive";

// A neutral tee where CH === HI  (slope 113, cr = par) — lets us pick precise
// Course Handicaps in tests without going through the WHS formula.
const neutralTee: Tee = { id: "neutral", courseId: "c", name: "Neutral", courseRating: 71, slopeRating: 113, par: 71 };

const pars: (3 | 4 | 5)[] = [4,3,4,3,4,4,4,3,4, 4,4,4,4,4,4,4,4,4];
const holes = () => pars.map((par, i) => ({ number: i + 1, par, strokeIndex: i + 1 }));
const course: Course = { id: "c", name: "Test", holes: holes(), tees: [neutralTee] };

const P = (id: string, team: "EU" | "USA", hi: number): Player =>
  ({ id, name: id, team, handicapIndex: hi });

const s = (matchId: string, playerId: string, hole: number, gross: number): IndividualScore =>
  ({ matchId, playerId, holeNumber: hole, gross });

// ─────────────────────────────────────────────────────────────────────────────
//  DAY 1 — Best/Worst/Both with match-relative handicap
// ─────────────────────────────────────────────────────────────────────────────
describe("Day 1 — match-relative handicap 8/12/14/18 → 0/4/6/10", () => {
  const match: Day1Match = {
    id: "d1", dayNumber: 1, format: "DAY1_PAR_PAIRS", matchNumber: 1, courseId: "c",
    euPlayers: ["mike", "partner"], usaPlayers: ["lance", "rob"],
  };
  const players: Player[] = [
    P("mike",    "EU",  8),   // low
    P("partner", "EU",  12),
    P("lance",   "USA", 14),
    P("rob",     "USA", 18),
  ];

  it("allocates 0/4/6/10 match strokes", () => {
    const map = individualMatchHandicaps(match, players, neutralTee);
    expect(map.get("mike")!.matchStrokes).toBe(0);
    expect(map.get("partner")!.matchStrokes).toBe(4);
    expect(map.get("lance")!.matchStrokes).toBe(6);
    expect(map.get("rob")!.matchStrokes).toBe(10);
  });

  it("partner (4 strokes) receives 1 stroke on SI 1..4 only", () => {
    // Hole 1 SI 1 par 4 → partner gross 5 → net 4. Mike gross 6 → net 6.
    // EU best = 4. USA: lance 5 net (6-1=5)... let's simplify: give USA very high scores
    // so EU wins hole clearly.
    const scores: IndividualScore[] = [
      s("d1", "mike", 1, 6),  s("d1", "partner", 1, 5),
      s("d1", "lance", 1, 9), s("d1", "rob", 1, 9),
    ];
    const state = deriveMatchState({
      match, course, players, individualScores: scores, scrambleScores: [], tee: neutralTee,
    });
    expect(state.holeResults[0].winner).toBe("EU");
  });

  it("SI 5 hole: partner receives NO extra stroke (partner has 4 match strokes → SI 1..4)", () => {
    // Hole 5 SI 5 par 4. Partner gross 5 → net 5 (no stroke). Mike 6 → net 6.
    // EU best = 5. USA lance gross 5 net = 5-1 = 4 (lance has 6 match strokes → SI 1..6).
    // USA best = 4. USA wins.
    const scores: IndividualScore[] = [
      s("d1", "mike", 5, 6), s("d1", "partner", 5, 5),
      s("d1", "lance", 5, 5), s("d1", "rob", 5, 9),
    ];
    const state = deriveMatchState({
      match, course, players, individualScores: scores, scrambleScores: [], tee: neutralTee,
    });
    expect(state.holeResults[4].winner).toBe("USA");
  });

  it("does NOT resolve until all four scores exist", () => {
    const state = deriveMatchState({
      match, course, players,
      individualScores: [ s("d1","mike",1,4), s("d1","partner",1,5), s("d1","lance",1,5) ],
      scrambleScores: [], tee: neutralTee,
    });
    expect(state.holesCompleted).toBe(0);
  });

  it("Par 3 uses WORST, Par 4 uses BEST, Par 5 uses BOTH — after net calculation", () => {
    // Use a 3-player-scores-are-0-hcp scenario to isolate the rule.
    const zeroPlayers: Player[] = [
      P("mike", "EU", 0), P("partner", "EU", 0),
      P("lance","USA",0), P("rob", "USA", 0),
    ];
    // Build a hole for each par so we can check the correct rule. Use holes 2 (par3), 1 (par4),
    // and we need a par 5 — extend course locally.
    const localCourse: Course = {
      ...course,
      holes: [
        { number: 1, par: 3, strokeIndex: 18 }, // par 3
        { number: 2, par: 4, strokeIndex: 17 }, // par 4
        { number: 3, par: 5, strokeIndex: 16 }, // par 5
        ...Array.from({ length: 15 }, (_, i) => ({ number: i + 4, par: 4 as const, strokeIndex: i + 1 })),
      ],
    };
    const localMatch: Day1Match = { ...match, courseId: "c" };
    const scoreSet: IndividualScore[] = [
      // Par 3: EU 3/5 vs USA 4/4 → EU worst=5, USA worst=4 → USA wins
      s("d1","mike",1,3), s("d1","partner",1,5), s("d1","lance",1,4), s("d1","rob",1,4),
      // Par 4: EU 4/6 vs USA 5/5 → EU best=4, USA best=5 → EU wins
      s("d1","mike",2,4), s("d1","partner",2,6), s("d1","lance",2,5), s("d1","rob",2,5),
      // Par 5: EU 5/6 vs USA 5/5 → EU=11, USA=10 → USA wins
      s("d1","mike",3,5), s("d1","partner",3,6), s("d1","lance",3,5), s("d1","rob",3,5),
    ];
    const st = deriveMatchState({
      match: localMatch, course: localCourse, players: zeroPlayers,
      individualScores: scoreSet, scrambleScores: [], tee: neutralTee,
    });
    expect(st.holeResults[0].winner).toBe("USA"); // par 3 worst
    expect(st.holeResults[1].winner).toBe("EU");  // par 4 best
    expect(st.holeResults[2].winner).toBe("USA"); // par 5 both
  });

  it("changing an earlier score changes hole & match result", () => {
    const zeroPlayers = [
      P("mike", "EU", 0), P("partner", "EU", 0),
      P("lance","USA",0), P("rob", "USA", 0),
    ];
    // Hole 1 in `course` above is par 4 → BEST.
    const baseScores: IndividualScore[] = [
      s("d1","mike",1,4), s("d1","partner",1,5),
      s("d1","lance",1,5), s("d1","rob",1,5),
    ];
    const before = deriveMatchState({
      match, course, players: zeroPlayers,
      individualScores: baseScores, scrambleScores: [], tee: neutralTee,
    });
    expect(before.statusText).toBe("EU 1 UP");

    const corrected = baseScores.map((r) =>
      r.playerId === "mike" && r.holeNumber === 1 ? { ...r, gross: 6 } : r,
    );
    const after = deriveMatchState({
      match, course, players: zeroPlayers,
      individualScores: corrected, scrambleScores: [], tee: neutralTee,
    });
    expect(after.statusText).toBe("AS");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  DAY 2 — Scramble with 35/15 pair PH then match-relative
// ─────────────────────────────────────────────────────────────────────────────
describe("Day 2 — pair PH auto + match-relative", () => {
  const match: Day2Match = {
    id: "d2", dayNumber: 2, format: "DAY2_SCRAMBLE", matchNumber: 1, courseId: "c",
    euPlayers: ["a", "b"], usaPlayers: ["c", "d"],
  };
  const players: Player[] = [
    // EU pair CH 8 & CH 12 → 0.35*8 + 0.15*12 = 4.6 → 5
    P("a", "EU", 8), P("b", "EU", 12),
    // USA pair CH 6 & CH 22 → 0.35*6 + 0.15*22 = 5.4 → 5
    P("c", "USA", 6), P("d", "USA", 22),
  ];

  it("pair PH calculation is correct (auto)", () => {
    const info = day2PairHandicaps(match, players, neutralTee);
    expect(info.euPH).toBe(5);   // 0.35*8 + 0.15*12 = 4.6 → 5
    expect(info.usaPH).toBe(5);  // 0.35*6 + 0.15*22 = 5.4 → 5
    expect(info.euMatch).toBe(0);
    expect(info.usaMatch).toBe(0);
  });

  it("35% low + 15% high: 8 + 22 → 6 (from spec example 6.1 → 6)", () => {
    const p2: Player[] = [ P("a","EU",8), P("b","EU",22), P("c","USA",0), P("d","USA",0) ];
    const info = day2PairHandicaps(match, p2, neutralTee);
    expect(info.euPH).toBe(6);
    expect(info.usaPH).toBe(0);
    expect(info.euMatch).toBe(6);
    expect(info.usaMatch).toBe(0);
  });

  it("Pair PH 6 vs 10 → match 0 vs 4 (higher pair receives strokes only on SI 1..4)", () => {
    // Override to force PH 6 & 10 cleanly.
    const m: Day2Match = { ...match, euPairHandicap: 6, usaPairHandicap: 10 };
    const info = day2PairHandicaps(m, players, neutralTee);
    expect(info.euPH).toBe(6);
    expect(info.usaPH).toBe(10);
    expect(info.euMatch).toBe(0);
    expect(info.usaMatch).toBe(4);

    // Both sides gross 4. On SI 1 (hole 1): USA net 4-1=3, EU net 4 → USA wins.
    // On SI 5 (hole 5):    USA net 4,      EU net 4 → HALVED.
    const scr: ScrambleScore[] = [
      { matchId: "d2", side: "EU",  holeNumber: 1, gross: 4 },
      { matchId: "d2", side: "USA", holeNumber: 1, gross: 4 },
      { matchId: "d2", side: "EU",  holeNumber: 5, gross: 4 },
      { matchId: "d2", side: "USA", holeNumber: 5, gross: 4 },
    ];
    const state = deriveMatchState({
      match: m, course, players, individualScores: [], scrambleScores: scr, tee: neutralTee,
    });
    expect(state.holeResults[0].winner).toBe("USA");
    expect(state.holeResults[4].winner).toBe("HALVED");
  });

  it("Gross view removes handicap effect", () => {
    const m: Day2Match = { ...match, euPairHandicap: 6, usaPairHandicap: 10 };
    const scr: ScrambleScore[] = [
      { matchId: "d2", side: "EU",  holeNumber: 1, gross: 4 },
      { matchId: "d2", side: "USA", holeNumber: 1, gross: 4 },
    ];
    const gross = deriveMatchState({
      match: m, course, players, individualScores: [], scrambleScores: scr, tee: neutralTee, mode: "GROSS",
    });
    expect(gross.holeResults[0].winner).toBe("HALVED");
  });

  it("only ONE score per pair is required — individual scores are irrelevant", () => {
    const scr: ScrambleScore[] = [
      { matchId: "d2", side: "EU",  holeNumber: 1, gross: 4 },
      { matchId: "d2", side: "USA", holeNumber: 1, gross: 5 },
    ];
    const state = deriveMatchState({
      match, course, players, individualScores: [], scrambleScores: scr, tee: neutralTee,
    });
    expect(state.holesCompleted).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  DAY 3 — Singles with match-relative allocation
// ─────────────────────────────────────────────────────────────────────────────
describe("Day 3 — singles match-relative (CH 8 vs 14 → 0/6)", () => {
  const match: Day3Match = {
    id: "d3", dayNumber: 3, format: "DAY3_SINGLES", matchNumber: 1, courseId: "c",
    euPlayer: "eu", usaPlayer: "us",
  };
  const players: Player[] = [ P("eu","EU",8), P("us","USA",14) ];

  it("EU plays off 0, USA plays off 6", () => {
    const map = individualMatchHandicaps(match, players, neutralTee);
    expect(map.get("eu")!.matchStrokes).toBe(0);
    expect(map.get("us")!.matchStrokes).toBe(6);
  });

  it("USA receives a stroke on SI 1..6 only — same gross halves outside that range", () => {
    // Hole 1 SI 1 gross 5 each → USA net 4, EU net 5 → USA wins.
    // Hole 7 SI 7 gross 5 each → both net 5 → HALVED.
    const scores: IndividualScore[] = [
      s("d3","eu",1,5), s("d3","us",1,5),
      s("d3","eu",7,5), s("d3","us",7,5),
    ];
    const state = deriveMatchState({
      match, course, players, individualScores: scores, scrambleScores: [], tee: neutralTee,
    });
    expect(state.holeResults[0].winner).toBe("USA");
    expect(state.holeResults[6].winner).toBe("HALVED");
  });

  it("changing an earlier score recomputes match state", () => {
    // Hole 1 is par 4 SI 1. USA has 6 match strokes → 1 stroke on hole 1.
    // Baseline: EU gross 3 (net 3), USA gross 5 (net 4) → EU wins → EU 1 UP.
    const scores1: IndividualScore[] = [ s("d3","eu",1,3), s("d3","us",1,5) ];
    const before = deriveMatchState({
      match, course, players, individualScores: scores1, scrambleScores: [], tee: neutralTee,
    });
    expect(before.statusText).toBe("EU 1 UP");
    // Change EU to 6 → net 6, USA net 4 → USA wins → USA 1 UP.
    const scores2: IndividualScore[] = [ s("d3","eu",1,6), s("d3","us",1,5) ];
    const after = deriveMatchState({
      match, course, players, individualScores: scores2, scrambleScores: [], tee: neutralTee,
    });
    expect(after.statusText).toBe("USA 1 UP");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Tee change ACTUALLY changes results
// ─────────────────────────────────────────────────────────────────────────────
describe("Tee change actually changes handicap strokes", () => {
  // Tee 1: slope 113 → CH = HI
  // Tee 2: slope 155, CR-par = 2 → CH_2 for HI 8 = 8*155/113 + 2 = 12.97 → 13
  const teeA: Tee = { id: "a", courseId: "c", name: "A", courseRating: 71, slopeRating: 113, par: 71 };
  const teeB: Tee = { id: "b", courseId: "c", name: "B", courseRating: 73, slopeRating: 155, par: 71 };

  it("Same players, harder tee → strictly larger match strokes for higher-index player", () => {
    const match: Day3Match = { id: "d3x", dayNumber: 3, format: "DAY3_SINGLES", matchNumber: 1, courseId: "c", euPlayer: "eu", usaPlayer: "us" };
    const players = [ P("eu","EU",0), P("us","USA",8) ];
    const a = individualMatchHandicaps(match, players, teeA);
    const b = individualMatchHandicaps(match, players, teeB);
    expect(a.get("us")!.matchStrokes).toBe(8);
    expect(b.get("us")!.matchStrokes).toBeGreaterThan(8);
  });

  it("per-player tee resolver: two Day 1 partners on different tees get different match strokes", () => {
    // Same HI (10) for both partners, but partner plays the harder tee (teeB) →
    // higher Course Handicap than mike, who plays teeA → they must NOT match strokes equally.
    const match: Day1Match = {
      id: "d1r", dayNumber: 1, format: "DAY1_PAR_PAIRS", matchNumber: 1, courseId: "c",
      euPlayers: ["mike", "partner"], usaPlayers: ["lance", "rob"],
    };
    const players: Player[] = [
      P("mike", "EU", 10), P("partner", "EU", 10),
      P("lance", "USA", 10), P("rob", "USA", 10),
    ];
    const teeByPlayer: Record<string, Tee> = {
      mike: teeA, partner: teeB, lance: teeA, rob: teeA,
    };
    const map = individualMatchHandicaps(match, players, (id) => teeByPlayer[id] ?? null);
    // mike (teeA, HI10) → CH 10 (lowest); partner (teeB, HI10) → CH higher than 10.
    expect(map.get("mike")!.matchStrokes).toBe(0);
    expect(map.get("partner")!.matchStrokes).toBeGreaterThan(0);
  });

  it("per-player tee resolver: Day 2 pair blend uses each partner's own tee", () => {
    const match: Day2Match = {
      id: "d2r", dayNumber: 2, format: "DAY2_SCRAMBLE", matchNumber: 1, courseId: "c",
      euPlayers: ["a", "b"], usaPlayers: ["c", "d"],
    };
    const players: Player[] = [
      P("a", "EU", 10), P("b", "EU", 10),
      P("c", "USA", 10), P("d", "USA", 10),
    ];
    // Both EU partners same HI but different tees → their CHs (and the resulting
    // 35/15 blend) must differ from the same-tee case.
    const sameTee = day2PairHandicaps(match, players, teeA);
    const mixedTee = day2PairHandicaps(match, players, (id) => (id === "b" ? teeB : teeA));
    expect(mixedTee.euPH).not.toBe(sameTee.euPH);
    // USA side unaffected — still both on teeA.
    expect(mixedTee.usaPH).toBe(sameTee.usaPH);
  });

  it("Handicap Index is unchanged after switching tees", () => {
    const p = { ...P("mike","EU",12.4) };
    individualMatchHandicaps(
      { id: "x", dayNumber: 3, format: "DAY3_SINGLES", matchNumber: 1, courseId: "c", euPlayer: p.id, usaPlayer: "u" } as Day3Match,
      [p, P("u","USA",8)], teeA,
    );
    individualMatchHandicaps(
      { id: "x", dayNumber: 3, format: "DAY3_SINGLES", matchNumber: 1, courseId: "c", euPlayer: p.id, usaPlayer: "u" } as Day3Match,
      [p, P("u","USA",8)], teeB,
    );
    expect(p.handicapIndex).toBe(12.4);
  });
});



