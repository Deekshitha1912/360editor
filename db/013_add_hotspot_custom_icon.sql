-- db/013_add_hotspot_custom_icon.sql
--
-- A new arrow_type, 'custom' -- a hotspot whose glyph is a user-uploaded
-- image instead of one of the fixed sprites in lib/arrows.js. It's a plain
-- billboard exactly like 'pulse' or any directional arrow (same generic
-- `image` marker branch in both middle.jsx's and export.jsx's marker
-- builders, same size/rotation/tooltip handling, same "On click" action
-- system as every other hotspot type — nothing about clicking it is
-- special), so no new action-related columns are needed here, only the
-- image URL itself. Null until the user uploads one, in which case the
-- lib/arrows.js placeholder glyph is shown instead.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same
-- as every prior migration in this file (no migration runner exists).

alter table public.hotspots
    add column if not exists custom_icon_url text;
