-- ─────────────────────────────────────────────────────────────────────────────
-- 0003  Per-tee hole yardages
--   Yardage is a tee-level attribute (Yellow vs White vs Red differ), so this
--   table becomes the source of truth. The legacy holes.yardage column is left
--   in place but no longer populated by the seed.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists tee_hole_yardages (
  tee_id   uuid not null references tees(id)  on delete cascade,
  hole_id  uuid not null references holes(id) on delete cascade,
  yardage  int  not null check (yardage between 40 and 800),
  primary key (tee_id, hole_id)
);

alter table tee_hole_yardages enable row level security;
drop policy if exists read_all on tee_hole_yardages;
create policy read_all on tee_hole_yardages for select using (true);

-- Note: holes.yardage stays for backwards-compatibility but should be regarded
--   as deprecated. Prefer tee_hole_yardages joined via the round's selected tee.

