-- ─────────────────────────────────────────────────────────────────────────────
-- 0002  Handicap Index + tees
--
--  * Renames players.playing_handicap → players.handicap_index (numeric(4,1))
--  * Adds `tees` table (per-course tee sets with rating/slope/par/yardage)
--  * Adds rounds.selected_tee_id (nullable during migration, then required)
--  * Adds match_sides.pair_handicap_override (renaming existing pair_handicap
--    for clarity — Day 2 pair PH is now derived unless an override is set).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Players: rename & retype handicap column ------------------------------
alter table players
  alter column playing_handicap type numeric(4,1) using playing_handicap::numeric(4,1);
alter table players rename column playing_handicap to handicap_index;

-- 2. Tees -----------------------------------------------------------------
create table if not exists tees (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references courses(id) on delete cascade,
  slug           text not null,
  name           text not null,                -- e.g. Yellow, White
  gender         text check (gender in ('MEN','WOMEN','MIXED')),
  course_rating  numeric(4,1) not null,
  slope_rating   int not null check (slope_rating between 55 and 155),
  par            int not null check (par between 60 and 80),
  total_yardage  int,
  unique(course_id, slug)
);

alter table tees enable row level security;
drop policy if exists read_all on tees;
create policy read_all on tees for select using (true);

-- 3. Rounds: selected tee ---------------------------------------------------
alter table rounds
  add column if not exists selected_tee_id uuid references tees(id) on delete restrict;

-- 4. Match sides: rename existing pair_handicap → pair_handicap_override ----
-- (kept as the manual override; derived PH lives in the app).
alter table match_sides rename column pair_handicap to pair_handicap_override;

-- 5. Note on holes.yardage
--   Per-hole yardage may vary by tee. For the MVP we keep hole yardage on
--   holes (single value). If per-tee hole yardage becomes required, add:
--     create table tee_hole_yardages ( tee_id uuid, hole_id uuid, yardage int,
--         primary key(tee_id, hole_id) );

