-- db/016_add_polygon_fill_opacity.sql
--
-- A zone's fill opacity, independent of its color (custom OR preset status).
-- Previously hardcoded as a fixed hex-alpha suffix appended to whatever
-- color colorForStatus() returned ('55' normally, '99' on hover — see
-- lib/polygons.js's normalizeFillOpacity/alphaHex/HOVER_ALPHA_BOOST, which
-- this column now feeds).
--
-- Default 0.33 matches that old hardcoded '55' suffix (0x55/255 ≈ 0.33)
-- exactly, so no existing zone changes appearance until its opacity is
-- actually adjusted in the form.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

alter table public.polygons
    add column if not exists fill_opacity numeric not null default 0.33;
