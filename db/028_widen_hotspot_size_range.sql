-- db/028_widen_hotspot_size_range.sql
--
-- db/002 capped hotspots.size at 40..400 with a check constraint. The app
-- now allows 15..1200 for most hotspot types and up to 12000 for a
-- 'siteplan' decal (lib/hotspots.js: HOTSPOT_SIZE_MIN / SITEPLAN_SIZE_MAX),
-- so every save outside the old range was being rejected by the database
-- ("Could not save the hotspot."). The per-type limit is enforced in
-- lib/hotspots.js's clampHotspotSize; this constraint is just the outer
-- bound.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

alter table public.hotspots drop constraint if exists hotspots_size_range;
alter table public.hotspots
    add constraint hotspots_size_range check (size is null or (size >= 15 and size <= 12000));
