-- Adds per-hotspot resize/rotate, additive to the existing shared
-- hotspot_size slider on projects (kept as-is -- a hotspot with size=NULL
-- still follows it). Apply by hand against dev, then production Supabase --
-- no migration runner exists in this repo (same workflow as 001).
-- Written to be safely re-runnable: a `size` column already existed on this
-- table before this migration (unused by any current code path -- nothing
-- reads or writes it today), typed integer, NOT NULL, with values outside
-- the 40-400 slider range -- all three of which made earlier versions of
-- this migration fail (integer rejects the decimal values the resize drag
-- produces, e.g. 67.89). That old column predates this feature entirely, so
-- it's converted to numeric, its NOT NULL constraint dropped, and its stray
-- values reset to NULL rather than rejected -- NULL just means "follow the
-- tour-wide default", which is the behavior every hotspot already had
-- regardless of that old column.
alter table public.hotspots
    add column if not exists size     numeric,
    add column if not exists rotation numeric not null default 0;

alter table public.hotspots
    alter column size drop not null,
    alter column size type numeric using size::numeric;

update public.hotspots
    set size = null
    where size is not null and (size < 40 or size > 400);

alter table public.hotspots
    drop constraint if exists hotspots_size_range,
    drop constraint if exists hotspots_rotation_range;

alter table public.hotspots
    add constraint hotspots_size_range     check (size is null or (size >= 40 and size <= 400)),
    add constraint hotspots_rotation_range check (rotation >= -180 and rotation <= 180);
