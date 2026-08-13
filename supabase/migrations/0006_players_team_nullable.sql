-- Players start unassigned (no team) until dragged onto EU or USA on the
-- /teams setup board. Once teams are locked, reassignment is blocked by
-- app logic (see src/app/actions/setup.ts), not by this constraint.
alter table players alter column team_id drop not null;
