-- db/011_fix_hotspots_update_policy.sql
-- Only run this if PATCH /api/hotspots/[id] keeps returning "The hotspot
-- could not be updated. Check the update policy on the hotspots table."
-- after the app-side fix in that route (checking rows?.length instead of
-- chaining .single() straight onto the update, which used to crash with
-- PostgREST's "Cannot coerce the result to a single JSON object" instead of
-- surfacing this clearly).
--
-- hotspots predates db/001_create_polygons.sql's migration-tracking
-- convention, so its RLS policies were never captured in this folder --
-- this recreates its UPDATE policy to match polygons_update's known-good
-- shape (both USING and WITH CHECK, both scoped through the owning
-- project), in case the live policy on hotspots is missing one of those.
--
-- Idempotent -- apply by hand against dev, then production Supabase.

drop policy if exists hotspots_update on public.hotspots;

create policy hotspots_update on public.hotspots
    for update
    using (
        exists (
            select 1 from public.projects p
            where p.id = hotspots.project_id and p.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from public.projects p
            where p.id = hotspots.project_id and p.user_id = auth.uid()
        )
    );
