import { TOTAL_CUP_POINTS } from "@/config/tournament";
import { buildScoringContext } from "@/lib/data";
import { loadTournamentMeta, loadRoundSettings } from "@/lib/tournamentData";
import { deriveAllMatchStates } from "@/lib/scoring/playerStats";
import { calculateCupStandings } from "@/lib/scoring/cup";
import { getHandicapStrokes } from "@/lib/scoring/handicap";
import { calculatePlayingHandicap } from "@/lib/scoring/courseHandicap";
import { courseHandicapFor, day2PairHandicaps } from "@/lib/scoring/derive";
import { CupScoreboard } from "@/components/CupScoreboard";
import { MatchCard } from "@/components/MatchCard";
import Link from "next/link";
import type { Day2Match, ScoringMode } from "@/lib/types";

export const dynamic = "force-dynamic";

const isMode = (v: unknown): v is ScoringMode => v === "NET" || v === "GROSS";
const isView = (v: unknown): v is "TEAM" | "INDIVIDUAL" => v === "TEAM" || v === "INDIVIDUAL";
type SortKey = "holes" | "toPar" | "gross" | "net";
const isSortKey = (v: unknown): v is SortKey =>
  v === "holes" || v === "toPar" || v === "gross" || v === "net";
const isDir = (v: unknown): v is "asc" | "desc" => v === "asc" || v === "desc";

interface Row {
  playerId: string;
  team: "EU" | "USA" | null;
  name: string;
  holes: number;
  toPar: number;
  gross: number;
  net: number;
}

function individualStrokeRows(mode: ScoringMode, ctx: Awaited<ReturnType<typeof buildScoringContext>>, dayNumber: 1 | 3): Row[] {
  const courseByMatch = new Map(ctx.matches.map((m) => [m.id, ctx.courses.find((c) => c.id === m.courseId)!]));
  const playerById = new Map(ctx.players.map((p) => [p.id, p]));
  const rows = new Map<string, Row>();
  for (const p of ctx.players) {
    rows.set(p.id, { playerId: p.id, team: p.team, name: p.name, holes: 0, toPar: 0, gross: 0, net: 0 });
  }
  for (const s of ctx.individualScores) {
    const match = ctx.matches.find((m) => m.id === s.matchId);
    if (!match || match.dayNumber !== dayNumber) continue;
    const player = playerById.get(s.playerId);
    if (!player) continue;
    const course = courseByMatch.get(match.id)!;
    const hole = course.holes.find((h) => h.number === s.holeNumber);
    if (!hole) continue;
    const tee = ctx.getTeeForMatch(match, player.id);
    const ch = courseHandicapFor(player, tee);
    const ph = calculatePlayingHandicap(ch, 100);
    const row = rows.get(player.id)!;
    const strokes = getHandicapStrokes(ph, hole.strokeIndex);
    row.holes += 1;
    row.gross += s.gross;
    row.net += s.gross - strokes;
    row.toPar += (mode === "NET" ? s.gross - strokes : s.gross) - hole.par;
  }
  return [...rows.values()]
    .filter((r) => r.holes > 0)
    .sort((a, b) => a.toPar - b.toPar || a.holes - b.holes);
}

interface PairRow {
  key: string;
  team: "EU" | "USA";
  players: string;
  holes: number;
  toPar: number;
  gross: number;
  net: number;
}

function scramblePairRows(mode: ScoringMode, ctx: Awaited<ReturnType<typeof buildScoringContext>>): PairRow[] {
  const day2Matches = ctx.matches.filter((m): m is Day2Match => m.dayNumber === 2);
  const courseByMatch = new Map(ctx.matches.map((m) => [m.id, ctx.courses.find((c) => c.id === m.courseId)!]));
  const playerById = new Map(ctx.players.map((p) => [p.id, p]));
  const rows: PairRow[] = [];

  for (const match of day2Matches) {
    const course = courseByMatch.get(match.id)!;
    const { euPH, usaPH } = day2PairHandicaps(
      match,
      ctx.players,
      (playerId: string) => ctx.getTeeForMatch(match, playerId),
      ctx.scrambleAllowance,
    );
    for (const side of ["EU", "USA"] as const) {
      const playerIds = side === "EU" ? match.euPlayers : match.usaPlayers;
      const players = playerIds.map((id) => playerById.get(id)?.name ?? id).join(" & ");
      const ph = side === "EU" ? euPH : usaPH;
      let holes = 0, gross = 0, net = 0, toPar = 0;
      for (const s of ctx.scrambleScores) {
        if (s.matchId !== match.id || s.side !== side) continue;
        const hole = course.holes.find((h) => h.number === s.holeNumber);
        if (!hole) continue;
        const strokes = getHandicapStrokes(ph, hole.strokeIndex);
        holes += 1;
        gross += s.gross;
        net += s.gross - strokes;
        toPar += (mode === "NET" ? s.gross - strokes : s.gross) - hole.par;
      }
      if (holes > 0) rows.push({ key: `${match.id}-${side}`, team: side, players, holes, toPar, gross, net });
    }
  }
  return rows.sort((a, b) => a.toPar - b.toPar || a.holes - b.holes);
}

export default async function LeaderboardPage({
  searchParams,
}: { searchParams: { view?: string; mode?: string; sort?: string; dir?: string } }) {
  const view = isView(searchParams.view) ? searchParams.view : "TEAM";
  const mode = isMode(searchParams.mode) ? searchParams.mode : "GROSS";
  const sort = isSortKey(searchParams.sort) ? searchParams.sort : "toPar";
  const dir = isDir(searchParams.dir) ? searchParams.dir : "asc";

  const [ctx, tournamentMeta, roundSettings] = await Promise.all([
    buildScoringContext(), loadTournamentMeta(), loadRoundSettings(),
  ]);
  // Team results (cup points, W/L/H) are always officially NET — the Net/Gross
  // toggle only affects the Individual view below, never match outcomes.
  const states = deriveAllMatchStates(ctx, "NET");
  const standings = calculateCupStandings([...states.values()], TOTAL_CUP_POINTS);
  const playerName = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? id;

  const tab = (label: string, params: Record<string, string>, active: boolean) => (
    <Link
      key={label}
      href={`/?${new URLSearchParams({ view, mode, sort, dir, ...params }).toString()}`}
      className={`px-4 py-2.5 rounded-full text-sm uppercase tracking-widest ${
        active ? "bg-ink text-cream" : "border border-ink/15 text-ink/70 hover:bg-ink/5"
      }`}
    >
      {label}
    </Link>
  );

  const modeToggleOption = (label: string, value: "NET" | "GROSS") => (
    <Link
      key={value}
      href={`/?${new URLSearchParams({ view, sort, dir, mode: value }).toString()}`}
      className={`px-2.5 py-1 uppercase tracking-widest ${
        mode === value ? "bg-ink text-cream" : "text-ink/60 hover:bg-ink/5"
      }`}
    >
      {label}
    </Link>
  );

  const sortRows = <T extends { holes: number; toPar: number; gross: number; net: number }>(rows: T[]): T[] =>
    [...rows].sort((a, b) => {
      const diff = (a[sort] - b[sort]) * (dir === "asc" ? 1 : -1);
      return diff !== 0 ? diff : a.holes - b.holes;
    });

  const sortHeader = (key: SortKey, label: string) => {
    const active = sort === key;
    const nextDir = active && dir === "asc" ? "desc" : "asc";
    return (
      <Link
        href={`/?${new URLSearchParams({ view, mode, sort: key, dir: nextDir }).toString()}`}
        className={active ? "text-ink font-semibold" : "text-ink/60 hover:text-ink"}
      >
        {label}{active ? (dir === "asc" ? " ↑" : " ↓") : ""}
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <CupScoreboard standings={standings} />

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {tab("Team", { view: "TEAM" }, view === "TEAM")}
          {tab("Individual", { view: "INDIVIDUAL" }, view === "INDIVIDUAL")}
        </div>
        {view === "INDIVIDUAL" && (
          <div className="flex shrink-0 rounded-full border border-ink/15 text-xs overflow-hidden">
            {modeToggleOption("Net", "NET")}
            {modeToggleOption("Gross", "GROSS")}
          </div>
        )}
      </div>

      {view === "TEAM" ? (
        <section className="space-y-6">
          {[1, 2, 3].map((day) => {
            const dayLocked = tournamentMeta.teamsLocked
              && (roundSettings.find((r) => r.dayNumber === day)?.pairingsLocked ?? false);
            const dayMatches = ctx.matches.filter((m) => m.dayNumber === day);
            return (
              <div key={day}>
                <h3 className="eyebrow mb-3">Day {day}</h3>
                {dayLocked ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dayMatches.map((m) => (
                      <MatchCard key={m.id} match={m} state={states.get(m.id)!} playerName={playerName} />
                    ))}
                  </div>
                ) : (
                  <section className="card p-6 text-center space-y-1">
                    <p className="eyebrow">Pairings TBD</p>
                    <p className="text-sm text-ink/60">The commissioner will unlock matchups once teams are set.</p>
                  </section>
                )}
              </div>
            );
          })}
        </section>
      ) : (
        <section className="space-y-6">
          <div>
            <p className="eyebrow mb-2">Individual {mode === "NET" ? "Net" : "Gross"} — Day 1</p>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-ink/5 text-ink/60 text-xs uppercase tracking-widest">
                  <tr>
                    <th className="text-left px-3 py-2">Golfer</th>
                    <th className="px-2 py-2">Team</th>
                    <th className="px-2 py-2 text-right">{sortHeader("holes", "Holes")}</th>
                    <th className="px-2 py-2 text-right">{sortHeader("toPar", "To Par")}</th>
                    <th className="px-2 py-2 text-right">{sortHeader("gross", "Gross")}</th>
                    <th className="px-2 py-2 text-right">{sortHeader("net", "Net")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortRows(individualStrokeRows(mode, ctx, 1)).map((r) => (
                    <tr key={r.playerId} className="border-t border-ink/5">
                      <td className="px-3 py-2 font-medium">
                        <Link href={`/players/${r.playerId}?day=1`} className="hover:underline">{r.name}</Link>
                      </td>
                      <td className="px-2 py-2">
                        {r.team ? (
                          <span className={r.team === "EU" ? "badge-eu" : "badge-usa"}>{r.team}</span>
                        ) : (
                          <span className="text-xs text-ink/30">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.holes}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.toPar > 0 ? `+${r.toPar}` : r.toPar === 0 ? "E" : r.toPar}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.gross}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.net}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="eyebrow mb-2">Pairs {mode === "NET" ? "Net" : "Gross"} — Day 2 · Scramble</p>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-ink/5 text-ink/60 text-xs uppercase tracking-widest">
                  <tr>
                    <th className="text-left px-3 py-2">Pair</th>
                    <th className="px-2 py-2">Team</th>
                    <th className="px-2 py-2 text-right">{sortHeader("holes", "Holes")}</th>
                    <th className="px-2 py-2 text-right">{sortHeader("toPar", "To Par")}</th>
                    <th className="px-2 py-2 text-right">{sortHeader("gross", "Gross")}</th>
                    <th className="px-2 py-2 text-right">{sortHeader("net", "Net")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortRows(scramblePairRows(mode, ctx)).map((r) => (
                    <tr key={r.key} className="border-t border-ink/5">
                      <td className="px-3 py-2 font-medium">{r.players}</td>
                      <td className="px-2 py-2">
                        <span className={r.team === "EU" ? "badge-eu" : "badge-usa"}>{r.team}</span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.holes}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.toPar > 0 ? `+${r.toPar}` : r.toPar === 0 ? "E" : r.toPar}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.gross}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.net}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="eyebrow mb-2">Individual {mode === "NET" ? "Net" : "Gross"} — Day 3 · Singles</p>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-ink/5 text-ink/60 text-xs uppercase tracking-widest">
                  <tr>
                    <th className="text-left px-3 py-2">Golfer</th>
                    <th className="px-2 py-2">Team</th>
                    <th className="px-2 py-2 text-right">{sortHeader("holes", "Holes")}</th>
                    <th className="px-2 py-2 text-right">{sortHeader("toPar", "To Par")}</th>
                    <th className="px-2 py-2 text-right">{sortHeader("gross", "Gross")}</th>
                    <th className="px-2 py-2 text-right">{sortHeader("net", "Net")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortRows(individualStrokeRows(mode, ctx, 3)).map((r) => (
                    <tr key={r.playerId} className="border-t border-ink/5">
                      <td className="px-3 py-2 font-medium">
                        <Link href={`/players/${r.playerId}?day=3`} className="hover:underline">{r.name}</Link>
                      </td>
                      <td className="px-2 py-2">
                        {r.team ? (
                          <span className={r.team === "EU" ? "badge-eu" : "badge-usa"}>{r.team}</span>
                        ) : (
                          <span className="text-xs text-ink/30">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.holes}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.toPar > 0 ? `+${r.toPar}` : r.toPar === 0 ? "E" : r.toPar}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.gross}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.net}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
