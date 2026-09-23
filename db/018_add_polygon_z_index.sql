-- db/018_add_polygon_z_index.sql
--
-- Paint order for overlapping zones. Photo Sphere Viewer draws markers in
-- plain array order (SVG painter's algorithm), which until now was just
-- whatever order the rows came back in -- so a large zone drawn over a road
-- or common area would cover the individual plots underneath it, with no
-- way to push it behind them.
--
-- Lower draws FIRST (underneath); higher draws last (on top). Default 0
-- means every existing zone keeps its current relative order exactly, since
-- ties fall back to the array order they already had (both marker builders
-- use a stable sort). See lib/polygons.js's normalizeZIndex, which clamps
-- the incoming value, and the polygonMarkers builders in middle.jsx /
-- export.jsx, which sort on it.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

alter table public.polygons
    add column if not exists z_index integer not null default 0;
