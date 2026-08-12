-- ─────────────────────────────────────────────────────────────────────────────
-- 0004  Teams lock flag
--   Tracks whether the EU/USA roster assignment has been "locked in" on the
--   /teams setup page. No auth gate protects this flag or the setup UI in
--   general (intentional — see src/app/actions/setup.ts).
-- ─────────────────────────────────────────────────────────────────────────────
alter table tournaments
  add column if not exists teams_locked boolean not null default false;
