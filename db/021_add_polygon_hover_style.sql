-- db/021_add_polygon_hover_style.sql
--
-- A zone's hover appearance, previously hardcoded: hovering reused the fill
-- colour and bumped its opacity by a fixed +0x44/255 (~0.27), with no way to
-- change either. These two columns make it configurable per zone, the same
-- way fill colour and fill opacity already are.
--
-- hover_color is nullable: null means "same as the fill", which is exactly
-- what hovering did before, so no existing zone changes appearance. Mirrors
-- border_color (db/017) rather than inventing a second convention.
--
-- hover_opacity is an ABSOLUTE value, not a bump added to fill_opacity. The
-- default 0.6 is what the old fixed boost produced for a zone left at the
-- default 0.33 fill (0.33 + 0.27 = 0.6), so the common case is unchanged.
-- A zone whose fill opacity was deliberately moved away from 0.33 will hover
-- at 0.6 instead of its old fill+0.27 -- accepted deliberately, because an
-- absolute value is the predictable thing to expose in a slider, and it also
-- allows effects a relative bump cannot, e.g. fill 0 + hover 0.6 for a zone
-- that is invisible until pointed at.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

alter table public.polygons
    add column if not exists hover_color text;

alter table public.polygons
    add column if not exists hover_opacity numeric not null default 0.6;
