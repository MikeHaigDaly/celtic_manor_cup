-- ─────────────────────────────────────────────────────────────────────────────
-- 0005  Per-player, per-day tee selection
--   Each golfer can pick their own tee per round, independent of teammates.
--   rounds.selected_tee_id remains as the seed-time default / fallback only.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists player_tee_selections (
  player_id  uuid not null references players(id) on delete cascade,
  round_id   uuid not null references rounds(id)  on delete cascade,
  tee_id     uuid not null references tees(id)    on delete restrict,
  primary key (player_id, round_id)
);

alter table player_tee_selections enable row level security;
drop policy if exists read_all on player_tee_selections;
create policy read_all on player_tee_selections for select using (true);
