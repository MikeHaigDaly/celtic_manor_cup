import Image from "next/image";
import type { CupStandings } from "@/lib/scoring/cup";
import { TOURNAMENT } from "@/config/tournament";
import { EuropeFlag, UsaFlag } from "@/components/TeamFlag";

export function CupScoreboard({ standings }: { standings: CupStandings }) {
  return (
    <section className="card p-6 md:p-8">
      <div className="text-center">
        <Image
          src="/logo.png" alt={TOURNAMENT.name} width={96} height={96} priority
          className="mx-auto rounded-full shadow-card"
        />
        <p className="eyebrow mt-4">{TOURNAMENT.subtitle} · {TOURNAMENT.year}</p>
        <h1 className="display text-3xl md:text-5xl mt-1">{TOURNAMENT.name}</h1>

        <div className="mt-6 grid grid-cols-3 items-end gap-4 max-w-md mx-auto">
          <div className="text-left">
            <EuropeFlag size={32} />
            <p className="eyebrow team-eu mt-1.5">Europe</p>
            <p className="display text-5xl md:text-6xl text-eu">{standings.euPoints}</p>
          </div>
          <div className="display text-3xl text-ink/40 pb-2">—</div>
          <div className="text-right">
            <UsaFlag size={32} className="ml-auto" />
            <p className="eyebrow team-usa mt-1.5">USA</p>
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

