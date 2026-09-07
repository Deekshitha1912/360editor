-- db/009_add_polygon_edge_lengths.sql
-- Per-edge length labels for a zone's boundary ("plot dimensions") — free-
-- form text (e.g. "12 ft", "3.6m"), typed in directly by the user rather than
-- computed from any calibration/scale, since zones live in angular sphere
-- coordinates with no inherent real-world unit. Edge i runs from points[i]
-- to points[(i+1) % points.length], so this array always has exactly as
-- many entries as the zone has points (padded/truncated on save — see
-- lib/polygons.js's normalizeEdgeLengths).
--
-- Idempotent — apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

alter table public.polygons add column if not exists edge_lengths jsonb not null default '[]'::jsonb;
