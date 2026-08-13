-- Per-hole scoring lock. A row's presence means that hole is locked for that
-- match (score inputs disabled client-side, writes blocked server-side) —
-- guards against an accidental stepper tap after a hole is finished.
create table if not exists match_hole_locks (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references matches(id) on delete cascade,
  hole_number  int  not null check (hole_number between 1 and 18),
  created_at   timestamptz not null default now(),
  unique(match_id, hole_number)
);

alter table match_hole_locks enable row level security;
drop policy if exists read_all on match_hole_locks;
create policy read_all on match_hole_locks for select using (true);
