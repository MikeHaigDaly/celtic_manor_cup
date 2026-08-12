-- ─────────────────────────────────────────────────────────────────────────────
-- CELTIC MANOR CUP — Initial schema
-- Raw gross scores only; everything else is derived in the application layer.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- Tournaments
create table if not exists tournaments (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  year         int  not null,
  status       text not null default 'active',
  created_at   timestamptz not null default now()
);

-- Teams
create table if not exists teams (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments(id) on delete cascade,
  code           text not null check (code in ('EU','USA')),
  name           text not null,
  short_name     text not null,
  sort_order     int  not null default 0,
  unique(tournament_id, code)
);

-- Players
create table if not exists players (
  id                 uuid primary key default gen_random_uuid(),
  tournament_id      uuid not null references tournaments(id) on delete cascade,
  team_id            uuid not null references teams(id) on delete restrict,
  slug               text not null,
  name               text not null,
  playing_handicap   int  not null,
  photo_url          text,
  sort_order         int  not null default 0,
  unique(tournament_id, slug)
);

-- Courses
create table if not exists courses (
  id     uuid primary key default gen_random_uuid(),
  slug   text unique not null,
  name   text not null
);

-- Holes
create table if not exists holes (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references courses(id) on delete cascade,
  hole_number    int  not null check (hole_number between 1 and 18),
  par            int  not null check (par in (3,4,5)),
  stroke_index   int  not null check (stroke_index between 1 and 18),
  yardage        int,
  unique(course_id, hole_number),
  unique(course_id, stroke_index)
);

-- Rounds (one row per Day)
create table if not exists rounds (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments(id) on delete cascade,
  day_number     int  not null check (day_number between 1 and 3),
  course_id      uuid not null references courses(id) on delete restrict,
  name           text not null,
  format         text not null check (format in ('DAY1_PAR_PAIRS','DAY2_SCRAMBLE','DAY3_SINGLES')),
  unique(tournament_id, day_number)
);

-- Matches
create table if not exists matches (
  id             uuid primary key default gen_random_uuid(),
  round_id       uuid not null references rounds(id) on delete cascade,
  slug           text not null,               -- e.g. d1m1
  match_number   int  not null,
  display_order  int  not null,
  unique(round_id, match_number),
  unique(round_id, slug)
);

-- Match sides (used for Day 2 pair handicaps; can also record team + pairing_position for D1/D3)
create table if not exists match_sides (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references matches(id) on delete cascade,
  team_id           uuid not null references teams(id) on delete restrict,
  side_code         text not null check (side_code in ('EU','USA')),
  pair_handicap     int,      -- only meaningful for Day 2
  unique(match_id, side_code)
);

-- Match players (which players play on which side of each match)
create table if not exists match_players (
  id                 uuid primary key default gen_random_uuid(),
  match_id           uuid not null references matches(id) on delete cascade,
  match_side_id      uuid not null references match_sides(id) on delete cascade,
  player_id          uuid not null references players(id) on delete restrict,
  pairing_position   int  not null default 1,
  unique(match_id, player_id)
);

-- Individual scores (Day 1 + Day 3)
create table if not exists scores (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references matches(id) on delete cascade,
  player_id     uuid not null references players(id) on delete cascade,
  hole_id       uuid not null references holes(id) on delete restrict,
  gross_score   int  not null check (gross_score between 1 and 20),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    text,
  unique(match_id, player_id, hole_id)
);

-- Scramble scores (Day 2) — one score per side per hole
create table if not exists scramble_scores (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references matches(id) on delete cascade,
  match_side_id  uuid not null references match_sides(id) on delete cascade,
  hole_id        uuid not null references holes(id) on delete restrict,
  gross_score    int  not null check (gross_score between 1 and 20),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     text,
  unique(match_id, match_side_id, hole_id)
);

-- updated_at trigger
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_scores_touch on scores;
create trigger trg_scores_touch before update on scores
  for each row execute function touch_updated_at();

drop trigger if exists trg_scramble_touch on scramble_scores;
create trigger trg_scramble_touch before update on scramble_scores
  for each row execute function touch_updated_at();

-- Realtime — enable publication of score tables
alter publication supabase_realtime add table scores;
alter publication supabase_realtime add table scramble_scores;

-- RLS: everyone can read; writes handled by service role from server-side actions.
alter table tournaments      enable row level security;
alter table teams            enable row level security;
alter table players          enable row level security;
alter table courses          enable row level security;
alter table holes            enable row level security;
alter table rounds           enable row level security;
alter table matches          enable row level security;
alter table match_sides      enable row level security;
alter table match_players    enable row level security;
alter table scores           enable row level security;
alter table scramble_scores  enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['tournaments','teams','players','courses','holes','rounds','matches','match_sides','match_players','scores','scramble_scores']) loop
    execute format('drop policy if exists read_all on %I;', t);
    execute format('create policy read_all on %I for select using (true);', t);
  end loop;
end $$;

