-- Per-day pairings lock: independent of tournaments.teams_locked (roster lock).
-- Lets the commissioner reveal each day's matchups on the leaderboard
-- sequentially instead of all-or-nothing.
alter table rounds add column if not exists pairings_locked boolean not null default false;
