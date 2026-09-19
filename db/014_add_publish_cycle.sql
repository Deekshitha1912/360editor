-- db/014_add_publish_cycle.sql
--
-- One credit buys a project a 1-year publishing window, not unlimited
-- hosting forever: publish_cycle_started_at is set ONCE, the first time a
-- project is ever published (never touched by later republishes), and is
-- the anchor lib/publish-cycle.js checks against. Past 365 days from that
-- date:
--   - the public tour link (app/[userId]/[slug]/route.js) serves the same
--     "not available" page as a deleted/unpublished tour -- no cron job,
--     just a lazy check on every request, so nothing has to be deleted.
--   - POST /api/projects/[id]/publish refuses to (re)publish.
-- POST /api/projects/[id]/renew spends one more credit to reset the clock
-- back to now(), un-blocking both of the above.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same
-- as every prior migration in this file (no migration runner exists).

alter table public.projects
    add column if not exists publish_cycle_started_at timestamptz;
