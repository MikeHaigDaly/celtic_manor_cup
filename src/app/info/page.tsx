export const dynamic = "force-static";

interface AgendaRow {
  time: string;
  event: string;
  detail?: string[];
}

interface AgendaDay {
  label: string;
  rows: AgendaRow[];
}

const AGENDA: AgendaDay[] = [
  {
    label: "Friday 21 Aug",
    rows: [
      {
        time: "12:00",
        event: "Twenty Ten Bar",
        detail: ["Handicaps finalised", "Captains' picks", "Player draft"],
      },
      {
        time: "14:10 & 14:20",
        event: "Round 1 — Twenty Ten",
        detail: [
          "Pairs · 2 points up for grabs",
          "Par 3 — worst net score counts",
          "Par 4 — best net score counts",
          "Par 5 — both net scores count",
        ],
      },
      { time: "20:00", event: "Dinner — Rafters", detail: ["Twenty Ten course"] },
    ],
  },
  {
    label: "Saturday 22 Aug",
    rows: [
      {
        time: "09:30 & 09:40",
        event: "Round 2 — Montgomerie",
        detail: [
          "Team scramble · 2 points up for grabs",
          "Both hit, then play the better ball",
          "One net score per hole, per pair*",
        ],
      },
      { time: "16:00", event: "Rugby kickoff", detail: ["South Africa vs New Zealand"] },
      { time: "17:45", event: "Dinner — The Grill Steakhouse" },
    ],
  },
  {
    label: "Sunday 23 Aug",
    rows: [
      {
        time: "08:40 & 08:50",
        event: "Round 3 — Roman Road",
        detail: [
          "Singles · 4 points up for grabs",
          "1 vs 1 — lower net score wins the hole",
        ],
      },
      { time: "After play", event: "Trophy Ceremony" },
    ],
  },
];

interface RuleRow {
  rule: string;
  detail: string;
}

const RULES: RuleRow[] = [
  { rule: "Preferred lies", detail: "One club length relief on fairways" },
  { rule: "Gimmies", detail: "Allowed" },
  { rule: "Lost ball", detail: "Treat as a red stake — drop nearby, 1-stroke penalty" },
];

export default function InfoPage() {
  return (
    <div className="space-y-6">
      <section className="card p-5">
        <p className="eyebrow">Celtic Manor Cup</p>
        <h1 className="display text-2xl mt-1">Trip Info</h1>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="eyebrow">Dates</span>
            <div className="font-medium">21–23 Aug</div>
          </div>
          <div>
            <span className="eyebrow">Location</span>
            <div className="font-medium">Celtic Manor Resort, Wales</div>
          </div>
          <div>
            <span className="eyebrow">Format</span>
            <div className="font-medium">Matchplay</div>
          </div>
        </div>
      </section>

      <section>
        <p className="eyebrow mb-2">Agenda</p>
        <div className="space-y-6">
          {AGENDA.map((day) => (
            <div key={day.label}>
              <p className="text-xs font-medium text-ink/50 mb-1.5">{day.label}</p>
              <div className="card overflow-hidden">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-[22%]" />
                    <col className="w-[30%]" />
                    <col className="w-[48%]" />
                  </colgroup>
                  <thead className="bg-ink/5 text-ink/60 text-xs uppercase tracking-widest">
                    <tr>
                      <th className="text-left px-3 py-2">Time</th>
                      <th className="text-left px-2 py-2">Event</th>
                      <th className="text-left px-3 py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.rows.map((row, i) => (
                      <tr key={i} className="border-t border-ink/5">
                        <td className="px-3 py-2 pt-2.5 whitespace-nowrap tabular-nums align-top">{row.time}</td>
                        <td className="px-2 py-2 pt-2.5 font-medium align-top">{row.event}</td>
                        <td className="px-3 py-2 text-ink/60 align-top">
                          {row.detail?.map((line, j) => (
                            <div key={j} className="py-0.5 leading-snug">{line}</div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink/40">
          * Pair handicap = 35% of the lower player's Course Handicap + 15% of the higher player's Course Handicap.
        </p>
      </section>

      <section className="card p-5 space-y-3 text-sm">
        <p className="eyebrow">How Scoring Works</p>
        <p className="font-semibold text-ink">
          Always enter your gross (actual) score — net is calculated for you automatically.
        </p>
        <p className="text-ink/70">
          Everyone gets a handicap for the weekend. It's adjusted for each course and tee played —
          the harder the course and the further back the tees, the higher your handicap, giving you
          more shots. This is calculated for you before every round.
        </p>
        <p className="text-ink/70">
          Each hole has a Stroke Index (SI) showing how hard it is — SI 1 is the hardest, SI 18 the
          easiest. You get a stroke on any hole where the SI is within your handicap.
        </p>
        <ul className="list-disc pl-5 text-ink/70 space-y-2">
          <li>
            18 handicap — you stroke on every hole
            <ul className="list-[circle] pl-5 mt-1 space-y-0.5 text-ink/60">
              <li>Score a 4 — net score is <strong className="text-ink">3</strong></li>
            </ul>
          </li>
          <li>
            0 handicap — you don't stroke on any hole
            <ul className="list-[circle] pl-5 mt-1 space-y-0.5 text-ink/60">
              <li>Score a 4 — net score is <strong className="text-ink">4</strong></li>
            </ul>
          </li>
          <li>
            24 handicap — double stroke on SI 1–6, single stroke on SI 7–18
            <ul className="list-[circle] pl-5 mt-1 space-y-0.5 text-ink/60">
              <li>SI 1–6 (double stroke) — score a 4, net score is <strong className="text-ink">2</strong></li>
              <li>SI 7–18 (single stroke) — score a 4, net score is <strong className="text-ink">3</strong></li>
            </ul>
          </li>
        </ul>
      </section>

      <section className="card p-5 text-sm">
        <p className="eyebrow mb-2">Prizes</p>
        <ul className="list-disc pl-5 text-ink/70 space-y-1">
          <li>Longest Drive — selected Par 5 each round</li>
          <li>Closest to the Pin — selected Par 3 each round</li>
          <li>Trophy ceremony following Sunday's round</li>
        </ul>
      </section>

      <section>
        <p className="eyebrow mb-2">Rules & Traditions</p>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink/5 text-ink/60 text-xs uppercase tracking-widest">
              <tr>
                <th className="text-left px-3 py-2">Rule</th>
                <th className="text-left px-2 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((row, i) => (
                <tr key={i} className="border-t border-ink/5">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{row.rule}</td>
                  <td className="px-2 py-2 text-ink/60">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5 space-y-4 text-sm">
        <p className="eyebrow">Getting There</p>
        <div>
          <p className="font-medium mb-1">Driving &amp; parking</p>
          <ul className="list-disc pl-5 text-ink/70 space-y-1">
            <li>Underground Resort Car Park — £20 per night (up to 24 hours)</li>
            <li>Catsash Outdoor Car Park — £8.50 per night (just outside the resort)</li>
          </ul>
        </div>
        <div>
          <p className="font-medium mb-1">Trains (Lance, Andy, Mike &amp; Jake)</p>
          <ul className="list-disc pl-5 text-ink/70 space-y-1">
            <li>Outbound, Fri 21 Aug — 08:48 London Paddington → 10:24 Newport (South Wales)</li>
            <li>Return, Sun 23 Aug — 18:33 Newport (South Wales) → 20:09 London Paddington</li>
          </ul>
          <p className="text-xs text-ink/40 mt-1">Newport is roughly a 15-minute Uber from Celtic Manor.</p>
        </div>
      </section>
    </div>
  );
}
