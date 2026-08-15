"use client";
import { useEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext, useDraggable, useDroppable, useSensor, useSensors,
  PointerSensor, TouchSensor, type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { COURSES } from "@/config/tournament";
import type { AnyMatch, Day1Match, Day2Match, Day3Match, Player, RoundSetting, TeamCode } from "@/lib/types";
import {
  setPlayerTeam, resetTeamAssignments, resetAllData, updatePlayerName, updatePlayerHandicap, setPlayerTee,
  setDayPairings, setDaySingles, lockTeams, unlockTeams,
} from "@/app/actions/setup";

interface Props {
  initialPlayers: Player[];
  initialRoundSettings: RoundSetting[];
  initialMatches: AnyMatch[];
  initialTeamsLocked: boolean;
  /** `${playerId}:${dayNumber}` -> tee slug. */
  initialTeeSelections: Map<string, string>;
}

type PairSlots = { EU: [string, string]; USA: [string, string] };
type Single = { euSlug: string; usaSlug: string };

function byMatchNumber<T extends { matchNumber: number }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.matchNumber - b.matchNumber);
}
function initPairs(matches: (Day1Match | Day2Match)[]): PairSlots[] {
  return byMatchNumber(matches).map((m) => ({ EU: m.euPlayers, USA: m.usaPlayers }));
}
function initSingles(matches: Day3Match[]): Single[] {
  return byMatchNumber(matches).map((m) => ({ euSlug: m.euPlayer, usaSlug: m.usaPlayer }));
}

function findPairSlot(
  pairs: PairSlots[], slug: string,
): { matchIndex: number; side: TeamCode; slot: number } | null {
  for (let matchIndex = 0; matchIndex < pairs.length; matchIndex++) {
    for (const side of ["EU", "USA"] as const) {
      for (let slot = 0; slot < 2; slot++) {
        if (pairs[matchIndex][side][slot] === slug) return { matchIndex, side, slot };
      }
    }
  }
  return null;
}

/* ── Small drag/drop primitives ─────────────────────────────────────────── */

function Chip({
  id, label, disabled, trailing,
}: { id: string; label: string; disabled?: boolean; trailing?: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    touchAction: "none",
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={clsx(
        "flex items-center justify-between gap-2 rounded-lg border border-ink/15 bg-cream px-3 py-2 text-sm font-medium select-none",
        disabled ? "cursor-default opacity-70" : "cursor-grab active:cursor-grabbing shadow-sm",
      )}
    >
      <span>{label}</span>
      {trailing}
    </div>
  );
}

function Slot({
  id, data, className, children,
}: { id: string; data?: Record<string, unknown>; className?: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id, data });
  return (
    <div ref={setNodeRef} className={clsx(className, isOver && "ring-2 ring-ink/40 ring-inset")}>
      {children}
    </div>
  );
}

function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // tolerance was 5px — tight enough that ordinary finger jitter during the
    // hold-to-drag delay reads as a scroll, cancelling the drag before it
    // starts and snapping the chip back (looks like a "reset" on a real phone).
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 12 } }),
  );
}

/* ── Team assignment ────────────────────────────────────────────────────── */

/** Two small toggle buttons — at most one selected, disabled once that team has 4. */
function TeamToggle({
  playerTeam, locked, euCount, usaCount, onSelect,
}: {
  playerTeam: TeamCode | null;
  locked: boolean;
  euCount: number;
  usaCount: number;
  onSelect: (team: TeamCode | null) => void;
}) {
  const countFor = (t: TeamCode) => (t === "EU" ? euCount : usaCount);

  const button = (t: TeamCode) => {
    const selected = playerTeam === t;
    const full = !selected && countFor(t) >= 4;
    const disabled = locked || full;
    return (
      <button
        key={t}
        type="button"
        disabled={disabled}
        onClick={() => onSelect(selected ? null : t)}
        className={clsx(
          "px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-widest border transition",
          selected && t === "EU" && "bg-eu text-cream border-eu",
          selected && t === "USA" && "bg-usa text-cream border-usa",
          !selected && !disabled && t === "EU" && "border-eu/40 text-eu hover:bg-eu/10",
          !selected && !disabled && t === "USA" && "border-usa/40 text-usa hover:bg-usa/10",
          !selected && disabled && "opacity-30 cursor-not-allowed border-ink/15 text-ink/30",
        )}
      >
        {t}
      </button>
    );
  };

  return (
    <div className="flex justify-center gap-1.5">
      {button("EU")}
      {button("USA")}
    </div>
  );
}

/* ── Handicaps ───────────────────────────────────────────────────────────── */

function HandicapTable({
  players, locked, euCount, usaCount, onTeamChange, onNameChange, onHandicapChange,
}: {
  players: Player[];
  locked: boolean;
  euCount: number;
  usaCount: number;
  onTeamChange: (slug: string, team: TeamCode | null) => void;
  onNameChange: (slug: string, name: string) => void;
  onHandicapChange: (slug: string, hi: number) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-ink/5 text-ink/60 text-[11px] uppercase tracking-widest">
          <tr>
            <th className="text-left px-3 py-2">Golfer</th>
            <th className="px-2 py-2">Team</th>
            <th className="px-2 py-2 text-right">Handicap Index</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className="border-t border-ink/5">
              <td className="px-3 py-2">
                <input
                  type="text"
                  defaultValue={p.name}
                  maxLength={40}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== p.name) onNameChange(p.id, v);
                    else e.target.value = p.name;
                  }}
                  className="w-full rounded border border-ink/15 px-2 py-1"
                />
              </td>
              <td className="px-2 py-2">
                <TeamToggle
                  playerTeam={p.team}
                  locked={locked}
                  euCount={euCount}
                  usaCount={usaCount}
                  onSelect={(team) => onTeamChange(p.id, team)}
                />
              </td>
              <td className="px-2 py-2 text-right">
                <input
                  type="number"
                  step="0.1"
                  min="-10"
                  max="54"
                  defaultValue={p.handicapIndex}
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) onHandicapChange(p.id, v);
                  }}
                  className="w-20 text-right rounded border border-ink/15 px-2 py-1 tabular-nums"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Tee selection (per player, per day) ────────────────────────────────── */

function TeeGrid({
  players, roundSettings, selections, onChange,
}: {
  players: Player[];
  roundSettings: RoundSetting[];
  selections: Map<string, string>;
  onChange: (playerSlug: string, day: 1 | 2 | 3, teeSlug: string) => void;
}) {
  const days = byMatchNumber(roundSettings.map((r) => ({ ...r, matchNumber: r.dayNumber })));
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-ink/5 text-ink/60 text-[11px] uppercase tracking-widest">
          <tr>
            <th className="text-left px-3 py-2">Golfer</th>
            {days.map((r) => {
              const course = COURSES.find((c) => c.id === r.courseId)!;
              return (
                <th key={r.dayNumber} className="px-2 py-2 font-normal">
                  Day {r.dayNumber}<br />
                  <span className="normal-case text-ink/40">{course.name.replace(/^Celtic Manor\s*—\s*/, "")}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className="border-t border-ink/5">
              <td className="px-3 py-2">{p.name}</td>
              {days.map((r) => {
                const course = COURSES.find((c) => c.id === r.courseId)!;
                const value = selections.get(`${p.id}:${r.dayNumber}`) ?? r.selectedTeeId;
                return (
                  <td key={r.dayNumber} className="px-2 py-2">
                    <select
                      value={value}
                      onChange={(e) => onChange(p.id, r.dayNumber, e.target.value)}
                      className="w-full rounded border border-ink/15 px-2 py-1 text-sm bg-cream"
                    >
                      {course.tees.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Day 1 / Day 2 pairing board (2 matches x 2 slots per team, swap-on-drop) ── */

function PairBoard({
  dayNumber, matches, pairs, locked, playerName, onSwap,
}: {
  dayNumber: 1 | 2;
  matches: (Day1Match | Day2Match)[];
  pairs: PairSlots[];
  locked: boolean;
  playerName: (id: string) => string;
  onSwap: (team: TeamCode, next: PairSlots[]) => void;
}) {
  const sensors = useDndSensors();
  const ordered = byMatchNumber(matches);

  function handleDragEnd(e: DragEndEvent) {
    if (!locked || !e.over) return;
    const activeSlug = e.active.id as string;
    const target = e.over.data.current as { matchIndex: number; side: TeamCode; slot: number } | undefined;
    if (!target) return;

    const source = findPairSlot(pairs, activeSlug);
    if (!source || source.side !== target.side) return; // only swap within the same team's board

    const next = pairs.map((p) => ({ EU: [...p.EU] as [string, string], USA: [...p.USA] as [string, string] }));
    const targetOccupant = next[target.matchIndex][target.side][target.slot];
    next[source.matchIndex][source.side][source.slot] = targetOccupant;
    next[target.matchIndex][target.side][target.slot] = activeSlug;
    onSwap(source.side, next);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ordered.map((m, matchIndex) => (
          <div key={m.id} className="card p-3 space-y-2">
            <p className="eyebrow">Match {m.matchNumber}</p>
            {(["EU", "USA"] as TeamCode[]).map((side) => (
              <div key={side} className="grid grid-cols-2 gap-2">
                {[0, 1].map((slot) => {
                  const slug = pairs[matchIndex]?.[side]?.[slot];
                  return (
                    <Slot
                      key={slot}
                      id={`pair-${dayNumber}-${m.id}-${side}-${slot}`}
                      data={{ matchIndex, side, slot }}
                      className={clsx(
                        "rounded-lg border border-dashed p-1 min-h-[2.75rem]",
                        side === "EU" ? "border-eu/30" : "border-usa/30",
                      )}
                    >
                      {slug && <Chip id={slug} label={playerName(slug)} disabled={!locked} />}
                    </Slot>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </DndContext>
  );
}

/* ── Day 3 singles board (EU anchored, USA draggable across 4 rows) ────────── */

function SinglesBoard({
  matches, singles, locked, playerName, onSwap,
}: {
  matches: Day3Match[];
  singles: Single[];
  locked: boolean;
  playerName: (id: string) => string;
  onSwap: (next: Single[]) => void;
}) {
  const sensors = useDndSensors();
  const ordered = byMatchNumber(matches);

  function handleDragEnd(e: DragEndEvent) {
    if (!locked || !e.over) return;
    const activeSlug = e.active.id as string;
    const targetRow = (e.over.data.current as { row: number } | undefined)?.row;
    if (targetRow == null) return;
    const sourceRow = singles.findIndex((s) => s.usaSlug === activeSlug);
    if (sourceRow === -1 || sourceRow === targetRow) return;
    const next = singles.map((s) => ({ ...s }));
    const tmp = next[sourceRow].usaSlug;
    next[sourceRow].usaSlug = next[targetRow].usaSlug;
    next[targetRow].usaSlug = tmp;
    onSwap(next);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-2">
        {ordered.map((m, row) => (
          <div key={m.id} className="card p-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <p className="text-sm font-medium">{playerName(singles[row]?.euSlug)}</p>
            <span className="text-ink/40 text-xs">vs</span>
            <Slot id={`singles-${m.id}`} data={{ row }} className="rounded-lg border border-dashed border-usa/30 p-1">
              {singles[row] && <Chip id={singles[row].usaSlug} label={playerName(singles[row].usaSlug)} disabled={!locked} />}
            </Slot>
          </div>
        ))}
      </div>
    </DndContext>
  );
}

/* ── Main board ──────────────────────────────────────────────────────────── */

export function TeamBoard({
  initialPlayers, initialRoundSettings, initialMatches, initialTeamsLocked, initialTeeSelections,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [roundSettings] = useState<RoundSetting[]>(initialRoundSettings);
  const [teeSelections, setTeeSelections] = useState<Map<string, string>>(initialTeeSelections);
  const [locked, setLocked] = useState(initialTeamsLocked);
  const [actionError, setActionError] = useState<string | null>(null);

  const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

  const day1Matches = initialMatches.filter((m): m is Day1Match => m.format === "DAY1_PAR_PAIRS");
  const day2Matches = initialMatches.filter((m): m is Day2Match => m.format === "DAY2_SCRAMBLE");
  const day3Matches = initialMatches.filter((m): m is Day3Match => m.format === "DAY3_SINGLES");
  const [day1Pairs, setDay1Pairs] = useState<PairSlots[]>(() => initPairs(day1Matches));
  const [day2Pairs, setDay2Pairs] = useState<PairSlots[]>(() => initPairs(day2Matches));
  const [singles, setSingles] = useState<Single[]>(() => initSingles(day3Matches));

  // initialMatches only changes when the server re-fetches (e.g. after
  // router.refresh()) — resync local pairing state so a server-side
  // change (like lockTeams() re-deriving pairings from the roster) shows
  // up without requiring a full page reload.
  useEffect(() => {
    setDay1Pairs(initPairs(day1Matches));
    setDay2Pairs(initPairs(day2Matches));
    setSingles(initSingles(day3Matches));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMatches]);

  // Team changes are batched (see handleMovePlayer) and no longer revert to
  // a pre-batch snapshot on a partial failure — resync just the `team`
  // field from confirmed server data instead, once it arrives via
  // router.refresh(). Scoped to `team` only so it can't clobber an
  // in-flight name/handicap edit for the same player.
  useEffect(() => {
    setPlayers((prev) => prev.map((p) => {
      const fresh = initialPlayers.find((ip) => ip.id === p.id);
      return fresh && fresh.team !== p.team ? { ...p, team: fresh.team } : p;
    }));
  }, [initialPlayers]);

  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? id;
  const euCount = players.filter((p) => p.team === "EU").length;
  const usaCount = players.filter((p) => p.team === "USA").length;

  function handleResetTeams() {
    setActionError(null);
    const prevPlayers = players;
    setPlayers((prev) => prev.map((p) => ({ ...p, team: null })));
    startTransition(async () => {
      try {
        await resetTeamAssignments();
      } catch (e) {
        setPlayers(prevPlayers);
        setActionError(errorMessage(e));
      }
      router.refresh();
    });
  }

  function handleFullReset() {
    const ok = window.confirm(
      "This wipes EVERYTHING for testing: unassigns all players, unlocks teams, " +
      "and deletes every score entered anywhere in the app. This cannot be undone. Continue?",
    );
    if (!ok) return;
    setActionError(null);
    setPlayers((prev) => prev.map((p) => ({ ...p, team: null })));
    setLocked(false);
    startTransition(async () => {
      try {
        await resetAllData();
      } catch (e) {
        setActionError(errorMessage(e));
      }
      router.refresh();
    });
  }

  // Rapid taps (assigning several players quickly) used to fire one full
  // mutation + full-page server refresh PER TAP — a burst of clicks could
  // mean dozens of Supabase round trips in a couple of seconds. Instead:
  // update the UI instantly on every tap, but only sync to the server once,
  // ~500ms after the taps stop — only the final team per player is sent.
  const pendingTeamChanges = useRef<Map<string, TeamCode | null>>(new Map());
  const teamChangeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleMovePlayer(slug: string, team: TeamCode | null) {
    setActionError(null);
    setPlayers((prev) => prev.map((p) => (p.id === slug ? { ...p, team } : p)));
    pendingTeamChanges.current.set(slug, team);

    if (teamChangeTimer.current) clearTimeout(teamChangeTimer.current);
    teamChangeTimer.current = setTimeout(() => {
      const changes = [...pendingTeamChanges.current.entries()];
      pendingTeamChanges.current.clear();
      startTransition(async () => {
        try {
          for (const [playerSlug, playerTeam] of changes) {
            await setPlayerTeam({ playerSlug, team: playerTeam });
          }
        } catch (e) {
          setActionError(errorMessage(e));
        }
        router.refresh();
      });
    }, 500);
  }

  function handleNameChange(slug: string, name: string) {
    setActionError(null);
    const prevPlayers = players;
    setPlayers((prev) => prev.map((p) => (p.id === slug ? { ...p, name } : p)));
    startTransition(async () => {
      try {
        await updatePlayerName({ playerSlug: slug, name });
      } catch (e) {
        setPlayers(prevPlayers);
        setActionError(errorMessage(e));
      }
      router.refresh();
    });
  }

  function handleHandicapChange(slug: string, handicapIndex: number) {
    setActionError(null);
    const prevPlayers = players;
    setPlayers((prev) => prev.map((p) => (p.id === slug ? { ...p, handicapIndex } : p)));
    startTransition(async () => {
      try {
        await updatePlayerHandicap({ playerSlug: slug, handicapIndex });
      } catch (e) {
        setPlayers(prevPlayers);
        setActionError(errorMessage(e));
      }
      router.refresh();
    });
  }

  function handleTeeSelect(playerSlug: string, dayNumber: 1 | 2 | 3, teeSlug: string) {
    setActionError(null);
    const prevSelections = teeSelections;
    setTeeSelections((prev) => new Map(prev).set(`${playerSlug}:${dayNumber}`, teeSlug));
    startTransition(async () => {
      try {
        await setPlayerTee({ playerSlug, dayNumber, teeSlug });
      } catch (e) {
        setTeeSelections(prevSelections);
        setActionError(errorMessage(e));
      }
      router.refresh();
    });
  }

  function handleLock() {
    setActionError(null);
    startTransition(async () => {
      try {
        await lockTeams();
        setLocked(true);
      } catch (e) {
        setActionError(errorMessage(e));
      }
      router.refresh();
    });
  }

  function handleUnlock() {
    setActionError(null);
    startTransition(async () => {
      try {
        await unlockTeams();
        setLocked(false);
      } catch (e) { setActionError(errorMessage(e)); }
      router.refresh();
    });
  }

  function handlePairSwap(day: 1 | 2, team: TeamCode, next: PairSlots[]) {
    setActionError(null);
    const setPairs = day === 1 ? setDay1Pairs : setDay2Pairs;
    const prevPairs = day === 1 ? day1Pairs : day2Pairs;
    setPairs(next);
    startTransition(async () => {
      try {
        await setDayPairings({ dayNumber: day, team, pairs: [next[0][team], next[1][team]] });
      } catch (e) {
        setPairs(prevPairs);
        setActionError(errorMessage(e));
      }
      router.refresh();
    });
  }

  function handleSinglesSwap(next: Single[]) {
    setActionError(null);
    const prevSingles = singles;
    setSingles(next);
    startTransition(async () => {
      try {
        await setDaySingles({ pairs: next.map((s) => ({ euPlayerSlug: s.euSlug, usaPlayerSlug: s.usaSlug })) });
      } catch (e) {
        setSingles(prevSingles);
        setActionError(errorMessage(e));
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {actionError && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="display text-lg">Golfers &amp; Teams</h2>
          <div className="flex items-center gap-2">
            {!locked && (euCount > 0 || usaCount > 0) && (
              <button onClick={handleResetTeams} className="btn-outline text-xs">Reset</button>
            )}
            {locked ? (
              <button onClick={handleUnlock} className="btn-outline text-xs">Unlock</button>
            ) : (
              <button onClick={handleLock} className="btn text-xs">Lock in teams</button>
            )}
            <button
              onClick={handleFullReset}
              className="btn-outline text-xs border-red-300 text-red-700 hover:bg-red-50"
              title="Wipes teams, pairings, and every score — for testing before the real event"
            >
              Full Reset
            </button>
          </div>
        </div>
        {!locked && (euCount !== 4 || usaCount !== 4) && (
          <p className="text-xs text-ink/50">Each team needs exactly 4 players to lock (currently EU {euCount}, USA {usaCount}).</p>
        )}
        <HandicapTable
          players={players}
          locked={locked}
          euCount={euCount}
          usaCount={usaCount}
          onTeamChange={handleMovePlayer}
          onNameChange={handleNameChange}
          onHandicapChange={handleHandicapChange}
        />
      </section>

      <section className="space-y-3">
        <h2 className="display text-lg">Tee choice</h2>
        <p className="text-xs text-ink/50">Each golfer picks their own tee, per day.</p>
        <TeeGrid players={players} roundSettings={roundSettings} selections={teeSelections} onChange={handleTeeSelect} />
      </section>

      <section className="space-y-3">
        <h2 className="display text-lg">Day 1 pairings</h2>
        {!locked && <p className="text-xs text-ink/50">Lock teams to arrange pairings.</p>}
        <PairBoard
          dayNumber={1} matches={day1Matches} pairs={day1Pairs} locked={locked}
          playerName={playerName} onSwap={(team, next) => handlePairSwap(1, team, next)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="display text-lg">Day 2 pairings</h2>
        {!locked && <p className="text-xs text-ink/50">Lock teams to arrange pairings.</p>}
        <PairBoard
          dayNumber={2} matches={day2Matches} pairs={day2Pairs} locked={locked}
          playerName={playerName} onSwap={(team, next) => handlePairSwap(2, team, next)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="display text-lg">Day 3 singles</h2>
        {!locked && <p className="text-xs text-ink/50">Lock teams to arrange matchups.</p>}
        <SinglesBoard matches={day3Matches} singles={singles} locked={locked} playerName={playerName} onSwap={handleSinglesSwap} />
      </section>
    </div>
  );
}
