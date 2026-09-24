-- db/022_add_hotspot_z_index.sql
--
-- Paint order for hotspots, the same concept db/018 added for zones. Right
-- now every hotspot type (including the surface-embedded 'text'/'floor'
-- decals) paints in plain array order, with no way to control which of two
-- overlapping decals sits on top.
--
-- Lower draws first (underneath); higher draws last (on top). Default 0
-- means every existing hotspot keeps its current relative order exactly,
-- since the sort is stable. See lib/hotspots.js's normalizeZIndex, and the
-- hotspot-marker builders in middle.jsx / export.jsx, which sort on it.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

alter table public.hotspots
    add column if not exists z_index integer not null default 0;
