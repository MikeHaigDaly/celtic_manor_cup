-- Whole-match sign-off, separate from per-hole locks. A signed match blocks
-- ALL further score/hole-lock changes until unsigned — the "the round is over,
-- finalize it" action, as opposed to a single hole's lock.
alter table matches add column if not exists signed_off boolean not null default false;
