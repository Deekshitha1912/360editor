-- db/017_add_polygon_border_color.sql
--
-- A zone's border (stroke) color, independent of its fill color (custom OR
-- preset status). Nullable -- null means "same as fill", matching how every
-- zone's border looked before this was configurable (the stroke was always
-- just colorForStatus()'s result, same as the fill). See
-- lib/polygons.js's normalizeBorderColor/borderColorFor, which this column
-- now feeds.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

alter table public.polygons
    add column if not exists border_color text;
