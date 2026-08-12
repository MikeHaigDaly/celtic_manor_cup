import type { CupStandings } from "@/lib/scoring/cup";
import { TOURNAMENT } from "@/config/tournament";

export function CupScoreboard({ standings }: { standings: CupStandings }) {
  return (
    <section className="card p-6 md:p-8">
      <div className="text-center">
        <p className="eyebrow">{TOURNAMENT.subtitle} · {TOURNAMENT.year}</p>
        <h1 className="display text-3xl md:text-5xl mt-1">{TOURNAMENT.name}</h1>

        <div className="mt-6 grid grid-cols-3 items-end gap-4 max-w-md mx-auto">
          <div className="text-left">
            <p className="eyebrow team-eu">Europe</p>
            <p className="display text-5xl md:text-6xl text-eu">{standings.euPoints}</p>
          </div>
          <div className="display text-3xl text-ink/40 pb-2">—</div>
          <div className="text-right">
            <p className="eyebrow team-usa">USA</p>
            <p className="display text-5xl md:text-6xl text-usa">{standings.usaPoints}</p>
          </div>
        </div>

        <p className="mt-6 text-sm tracking-widest uppercase text-ink/70">
          {standings.status}
        </p>
      </div>
    </section>
  );
}

