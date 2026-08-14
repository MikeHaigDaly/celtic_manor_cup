import { COURSES } from "@/config/tournament";
import { buildScoringContext } from "@/lib/data";
import { deriveAllMatchStates } from "@/lib/scoring/playerStats";
import { MatchCard } from "@/components/MatchCard";
import { notFound } from "next/navigation";

// Cached; invalidated by revalidatePath() in the score/setup server actions.

const DAY_META: Record<1 | 2 | 3, { title: string; sub: string; courseId: string; blurb: string; points: number }> = {
  1: {
    title: "Day 1",
    sub: "Best / Worst / Both — Pairs Match Play",
    courseId: "twenty-ten",
    blurb: "Par 3 — Worst Ball · Par 4 — Best Ball · Par 5 — Both Count",
    points: 2,
  },
  2: {
    title: "Day 2",
    sub: "Two-Man Scramble",
    courseId: "montgomerie",
    blurb: "One team score per hole; lowest net wins.",
    points: 2,
  },
  3: {
    title: "Day 3",
    sub: "Singles",
    courseId: "roman-road",
    blurb: "Four singles matches; four Cup points on the line.",
    points: 4,
  },
};

export default async function DayPage({ params }: { params: { n: string } }) {
  const n = Number(params.n);
  if (n !== 1 && n !== 2 && n !== 3) return notFound();
  const day = n as 1 | 2 | 3;
  const meta = DAY_META[day];
  const course = COURSES.find((c) => c.id === meta.courseId)!;

  const ctx = await buildScoringContext();
  const states = deriveAllMatchStates(ctx, "NET");
  const playerName = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? id;
  const matches = ctx.matches.filter((m) => m.dayNumber === day);

  const euPoints = matches.reduce((s, m) => s + states.get(m.id)!.euPoints, 0);
  const usaPoints = matches.reduce((s, m) => s + states.get(m.id)!.usaPoints, 0);

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <p className="eyebrow">{course.name}</p>
        <h1 className="display text-2xl mt-1">{meta.title} · {meta.sub}</h1>
        <p className="mt-2 text-sm text-ink/70">{meta.blurb}</p>
        <div className="mt-4 flex gap-4 text-sm">
          <div><span className="eyebrow">Points</span><div className="font-medium">{meta.points} available</div></div>
          <div><span className="eyebrow team-eu">Europe</span><div className="font-medium team-eu">{euPoints}</div></div>
          <div><span className="eyebrow team-usa">USA</span><div className="font-medium team-usa">{usaPoints}</div></div>
        </div>
      </section>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {matches.map((m) => <MatchCard key={m.id} match={m} state={states.get(m.id)!} playerName={playerName} />)}
      </div>
    </div>
  );
}

