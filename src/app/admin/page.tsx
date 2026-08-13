import Link from "next/link";
import { TOURNAMENT, SCRAMBLE_ALLOWANCE, courseById } from "@/config/tournament";
import {
  loadPlayers, loadMatches, loadRoundSettings, loadPlayerTeeSelections, teeForPlayerFromSelections,
} from "@/lib/tournamentData";
import {
  calculateCourseHandicap, calculatePlayingHandicap,
} from "@/lib/scoring/courseHandicap";
import { day2PairHandicaps, individualMatchHandicaps } from "@/lib/scoring/derive";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [players, matches, roundSettings, teeSelections] = await Promise.all([
    loadPlayers(), loadMatches(), loadRoundSettings(), loadPlayerTeeSelections(),
  ]);
  const pName = (id: string) => players.find((p) => p.id === id)?.name ?? id;
  const playerById = (id: string) => players.find((p) => p.id === id);
  const getTee = (playerId: string, day: 1 | 2 | 3) =>
    teeForPlayerFromSelections({ dayNumber: day }, playerId, teeSelections, roundSettings);
  const DAY1_MATCHES = matches.filter((m) => m.format === "DAY1_PAR_PAIRS");
  const DAY2_MATCHES = matches.filter((m) => m.format === "DAY2_SCRAMBLE");
  const DAY3_MATCHES = matches.filter((m) => m.format === "DAY3_SINGLES");

  return (
    <div className="space-y-8">
      <section>
        <h1 className="display text-2xl">Admin · {TOURNAMENT.name} {TOURNAMENT.year}</h1>
        <p className="text-sm text-ink/70 mt-1">
          Team assignment, handicaps, tee selection, and pairings are edited on the{" "}
          <Link href="/teams" className="underline">Teams</Link> page. Below is a read-only
          reference showing every calculated Course/Playing Handicap for the currently selected tees.
        </p>
      </section>

      <section>
        <h2 className="display text-lg mb-2">Players · Handicap Index</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink/5 text-ink/60 text-[11px] uppercase tracking-widest">
              <tr><th className="text-left px-3 py-2">Name</th><th className="px-2 py-2">Team</th><th className="px-2 py-2 text-right">HI</th></tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} className="border-t border-ink/5">
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-2 py-2">
                    {p.team ? (
                      <span className={p.team === "EU" ? "badge-eu" : "badge-usa"}>{p.team}</span>
                    ) : (
                      <span className="text-xs text-ink/30">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{p.handicapIndex.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {roundSettings.map((r) => {
        const course = courseById(r.courseId)!;
        return (
          <section key={r.dayNumber}>
            <h2 className="display text-lg mb-2">Day {r.dayNumber} · {course.name}</h2>
            <div className="card overflow-hidden mt-3">
              <table className="w-full text-sm">
                <thead className="bg-ink/5 text-ink/60 text-[11px] uppercase tracking-widest">
                  <tr>
                    <th className="text-left px-3 py-2">Golfer</th>
                    <th className="px-2 py-2">Tee</th>
                    <th className="px-2 py-2 text-right">HI</th>
                    <th className="px-2 py-2 text-right">Course HC</th>
                    <th className="px-2 py-2 text-right">Playing</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => {
                    const tee = getTee(p.id, r.dayNumber);
                    const ch = calculateCourseHandicap(p.handicapIndex, tee);
                    const ph = calculatePlayingHandicap(ch, 100);
                    return (
                      <tr key={p.id} className="border-t border-ink/5">
                        <td className="px-3 py-2">{p.name}</td>
                        <td className="px-2 py-2 text-ink/70">{tee.name}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{p.handicapIndex.toFixed(1)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{ch}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{ph}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <section>
        <h2 className="display text-lg mb-2">Day 1 pairings · match handicaps</h2>
        <ul className="space-y-2 text-sm">
          {DAY1_MATCHES.map((m) => {
            const strokes = individualMatchHandicaps(m, players, (id) => getTee(id, 1));
            const row = (id: string) => {
              const info = strokes.get(id)!;
              return `${pName(id)} (HI ${playerById(id)!.handicapIndex.toFixed(1)} · CH ${info.ch} · MATCH ${info.matchStrokes})`;
            };
            return (
              <li key={m.id} className="card p-3 space-y-1">
                <p className="team-eu">{m.euPlayers.map(row).join(" · ")}</p>
                <p className="team-usa">{m.usaPlayers.map(row).join(" · ")}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="display text-lg mb-2">Day 2 scramble · pair PH</h2>
        <p className="text-xs text-ink/60 mb-2">
          Allowance: {(SCRAMBLE_ALLOWANCE.low * 100).toFixed(0)}% low + {(SCRAMBLE_ALLOWANCE.high * 100).toFixed(0)}% high, applied directly by hole SI (same convention as Days 1/3).
        </p>
        <ul className="space-y-2 text-sm">
          {DAY2_MATCHES.map((m) => {
            const info = day2PairHandicaps(m, players, (id) => getTee(id, 2), SCRAMBLE_ALLOWANCE);
            return (
              <li key={m.id} className="card p-3 space-y-1">
                <p>M{m.matchNumber}:
                  <span className="team-eu"> {m.euPlayers.map(pName).join(" / ")}</span>
                  <span className="text-ink/40 mx-1">vs</span>
                  <span className="team-usa">{m.usaPlayers.map(pName).join(" / ")}</span>
                </p>
                <p className="text-xs text-ink/60">
                  EU Pair PH <b className="text-ink">{info.euPH}</b>{info.euOverride ? " (override)" : ""} ·
                  USA Pair PH <b className="text-ink ml-1">{info.usaPH}</b>{info.usaOverride ? " (override)" : ""}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="display text-lg mb-2">Day 3 singles · match handicaps</h2>
        <ul className="space-y-2 text-sm">
          {DAY3_MATCHES.map((m) => {
            const strokes = individualMatchHandicaps(m, players, (id) => getTee(id, 3));
            const line = (id: string) => {
              const info = strokes.get(id)!;
              return `${pName(id)} (HI ${playerById(id)!.handicapIndex.toFixed(1)} · CH ${info.ch} · MATCH ${info.matchStrokes})`;
            };
            return (
              <li key={m.id} className="card p-3 space-y-1">
                <p className="team-eu">{line(m.euPlayer)}</p>
                <p className="team-usa">{line(m.usaPlayer)}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

