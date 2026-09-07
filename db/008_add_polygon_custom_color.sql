-- db/008_add_polygon_custom_color.sql
-- A custom status (anything not in lib/polygons.js's STATUS_COLORS map —
-- available/booked/reserved) always fell back to one fixed default color
-- with no way to pick something else. This adds an optional per-zone
-- override, used only when the status is custom; a preset status still
-- always uses its own fixed color regardless of what's stored here.
--
-- Nullable — null means "use the default color for a custom status", same
-- "no override yet" convention as hotspots.color (db/003_add_hotspot_color.sql).
--
-- Idempotent — apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

alter table public.polygons add column if not exists custom_color text;
