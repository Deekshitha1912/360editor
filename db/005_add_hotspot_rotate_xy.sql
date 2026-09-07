-- db/005_add_hotspot_rotate_xy.sql
-- Adds the two extra rotation axes needed for the 'floor' hotspot type to be
-- a freely-orientable 3D plane (imageLayer marker) instead of a locked-flat
-- decal. The existing `rotation` column is reused as the third axis (Z/roll)
-- -- same "reuse existing fields per-type" convention as every other hotspot
-- style added this session. Nullable; only 'floor' hotspots ever write real
-- values here. Idempotent.

alter table hotspots add column if not exists rotate_x numeric;
alter table hotspots add column if not exists rotate_y numeric;
