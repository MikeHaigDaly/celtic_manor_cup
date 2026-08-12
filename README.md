# Celtic Manor Cup

Private live scoring web app for the annual eight-golfer Europe vs USA trip.

- **Next.js 14 (App Router)** + TypeScript + Tailwind
- **Supabase** Postgres (raw scores) + Realtime (instant leaderboard)
- Deploy on **Vercel**
- Mobile-first UI, shared scorer PIN, no user accounts

## Local run

```bash
npm install
cp .env.example .env.local        # fill in your values
npm run seed                      # seeds Supabase from src/config/tournament.ts
npm run dev                       # http://localhost:3000
npm run test                      # scoring engine unit tests
npm run typecheck                 # tsc --noEmit
```

## Supabase

1. Create a Supabase project.
2. Enable Realtime (default on).
3. Run the SQL migrations in order in the Supabase SQL editor:
   ```
   supabase/migrations/0001_init.sql
   supabase/migrations/0002_handicap_tees.sql
   supabase/migrations/0003_tee_hole_yardages.sql
   ```
4. Copy the project URL + anon + service-role keys into `.env.local`.
5. `npm run seed` — populates tournaments/teams/players/courses/holes/**tees**/**tee_hole_yardages**/rounds/matches from the config. The seed calls the course validator first (`validateAllCourses`) so it fails fast on bad data.

Re-running `npm run seed` after changing `src/config/tournament.ts` is safe (upserts). Raw scores are never touched by the seed.

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=       # https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # anon public key
SUPABASE_SERVICE_ROLE_KEY=      # service-role — server only
SCORER_PIN=1234                 # shared PIN for scorers
SCORER_COOKIE_SECRET=change-me  # any long random string; signs the scorer cookie
```

## Tournament configuration

Everything tournament-specific lives in **one file**:

```
src/config/tournament.ts
```

Change here, then `npm run seed`:

- `TOURNAMENT.year`
- `PLAYERS` — names, `team` (`"EU"` / `"USA"`), **`handicapIndex`** (decimal), optional `photoUrl`
- `COURSES[*].holes[*]` — replace placeholder `par`, `strokeIndex`, `yardage` with the real Celtic Manor data (**Twenty Ten / Montgomerie / Roman Road**)
- `COURSES[*].tees[*]` — per-tee `courseRating`, `slopeRating`, `par`, `totalYardage`
- `ROUND_SETTINGS` — the tee played each day (change here → all handicaps recompute)
- `HANDICAP_ALLOWANCES` — allowance % applied to Course Handicap → Playing Handicap
- `SCRAMBLE_ALLOWANCE` — 2-man scramble allowance (default 35 % low + 15 % high)
- `DAY1_MATCHES` — Day 1 pairings
- `DAY2_MATCHES` — Day 2 pairings; `euPairHandicap` / `usaPairHandicap` are **optional overrides**
- `DAY3_MATCHES` — Day 3 singles matchups

Placeholders are all marked with `// TODO:` in the file.

## Handicap engine

The app implements a proper **Handicap Index → Course Handicap → Playing Handicap → Match Handicap** pipeline:

1. Each golfer has ONE locked `handicapIndex` (decimal, e.g. `10.7`).
2. Each round has a `selectedTeeId` (in `ROUND_SETTINGS`).
3. For every match the app derives:
   - **Course Handicap** = `round( HI × Slope/113 + (CR − Par) )`
   - **Playing Handicap** = `round( CH × allowance % )`
   - **Match Handicap** = subtract-lowest across all competitors in that match; the lowest plays off zero, everyone else receives 100% of the difference. This is applied consistently on **Day 1** (4 players), **Day 2** (2 pairs) and **Day 3** (2 players).
   - Per-hole strokes then come from `getHandicapStrokes(matchStrokes, SI)`.
4. **Day 2 scramble**: each pair's Playing Handicap is computed from both players' Course Handicaps via **35 % low + 15 % high** (config: `SCRAMBLE_ALLOWANCE`). The two pair PHs are then reduced by subtract-lowest so the higher pair receives the full difference. A per-match `euPairHandicap`/`usaPairHandicap` in config still wins as a manual override.
5. Change the selected tee → all Course Handicaps, match strokes and net results recompute automatically. The Handicap Index is never mutated.
6. There is exactly one gross score per pair per Day 2 hole — no individual scramble scores are fabricated. Day 2 does not enter individual stroke stats but does count towards W/L/H and Cup points.

Individual-to-par stroke stats on the leaderboard and player profile use each player's full **Playing Handicap on the selected tee** (not the match-relative allocation).

## Course data & validation

Verified 2024/25 Celtic Manor men's tee ratings are configured for all three courses (White/Yellow/Red on Twenty Ten, Montgomerie, Roman Road). Montgomerie and Roman Road **Yellow** hole yardages are supplied and sum to 5787 and 5964 respectively; other tees have tee-level totals but pending hole yardages (marked TODO). Twenty Ten hole yardages are pending; par and stroke index are verified.

`src/lib/config/validate.ts` guards the config at seed time — 18 holes, unique SI 1–18, `sum(pars) === tee.par`, and (when supplied) `sum(holeYardages) === tee.totalYardage`.

## Scoring rules (built into the engine)

- **Day 1** (Twenty Ten) — pairs, per-hole rule by par: **Par 3 = Worst Ball, Par 4 = Best Ball, Par 5 = Both Scores (sum)**. Handicap strokes applied to each golfer individually first, then the pair calculation runs. Official = NET; also viewable as GROSS.
- **Day 2** (Montgomerie) — 2-man scramble, one team score per hole, one configured pair handicap per side. Official = NET.
- **Day 3** (Roman Road) — singles, individual gross → net. Official = NET.
- Match play with automatic close-out (e.g. `EU 3&2`). Match halved after 18 all-square.
- Cup points: 1 for a win, 0.5 each for halved, 0 for a loss. 8 available. >4 wins the Cup; 4-4 = tied.

## Deployment (Vercel)

1. Push repo to GitHub.
2. Import into Vercel.
3. Add the same env vars as `.env.local`.
4. Deploy. The scorer PIN is server-side only; scoring works from any device on the shared URL after entering the PIN at `/score`.

## Structure

```
src/
  config/tournament.ts           ← single source of truth (edit here)
  lib/
    types.ts
    scoring/                     ← pure business logic (unit-tested)
      handicap.ts day1.ts day2.ts day3.ts matchState.ts
      cup.ts derive.ts playerStats.ts
    supabase/{browser,server,admin}.ts
    auth.ts                      ← scorer PIN cookie helpers
    data.ts                      ← raw score reads
  app/
    layout.tsx page.tsx globals.css
    leaderboard/ days/[n]/ matches/[id]/ players/ players/[slug]/
    score/ score/login/ score/[matchId]/ admin/
    actions/{scores,auth}.ts     ← server actions (all writes)
  components/                    ← UI (CupScoreboard, MatchCard, ScoreEntry, Nav, LiveBadge)
  hooks/useLiveScores.ts         ← Supabase Realtime → router.refresh()
scripts/seed.ts                  ← reads tournament.ts and upserts Supabase
supabase/migrations/0001_init.sql
```

## Notes

- Scores are raw gross only. Every derived thing (net, hole winners, match state, cup, stats) is computed by pure functions in `src/lib/scoring`.
- Day 2 individual stroke stats are **never** fabricated — the scramble contributes to W-L-H and Cup points only.
- No Redis, no auth provider, no queues. Simple > clever.

