-- db/025_add_project_cover_logo.sql
--
-- A single logo image shown on the published tour's own loading screen
-- (#loadOverlay in export.jsx), above the project name -- distinct from the
-- existing `overlays` column, which holds screen-anchored watermarks shown
-- WHILE touring (possibly several, each scoped to one scene or every scene).
-- This is exactly one image, shown only once, before the viewer even starts.
--
-- Nullable: null means "no logo uploaded" -- the loading screen falls back
-- to showing just the project name, exactly today's behavior.
--
-- Stores a public URL (same convention as every other image field in this
-- app - overlays[].url, coverups[].url, custom_icon_url), uploaded via the
-- existing generic POST /api/projects/[id]/overlay-image endpoint.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

alter table public.projects
    add column if not exists cover_logo_url text;
