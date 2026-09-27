-- db/024_add_hotspot_plan_shapes.sql
--
-- Parsed DXF geometry for the 'siteplan' hotspot arrow_type -- a site/floor
-- plan placed and rotated exactly like a floor/text decal (same imageLayer
-- mechanism, same rotate_x/rotate_y/rotation columns, same on-canvas gizmo),
-- replacing the old click-pair-calibrated reference plan (db/015, since
-- dropped from scenes.reference_plan -- that column is now unused code-side,
-- left in place rather than dropped, since dropping a column is a more
-- destructive step than just no longer reading/writing it).
--
-- Nullable: null means "no DXF imported yet" -- a freshly-dropped siteplan
-- hotspot has nothing to render until one is picked, same shape as
-- custom_icon_url being empty on a fresh 'custom' hotspot.
--
-- Shape: { shapes: [{ tag: 'polyline'|'polygon', pts: [[x,y], ...] }, ...],
-- bbox: { minX, minY, maxX, maxY } } -- exactly lib/dxf.js's
-- dxfTextToShapes() return value, stored as-is. See lib/arrows.js's
-- planDecalImage, which renders this into the actual decal image, and
-- lib/hotspots.js's normalizePlanShapes, which bounds it before it's ever
-- written.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

alter table public.hotspots
    add column if not exists plan_shapes jsonb;
