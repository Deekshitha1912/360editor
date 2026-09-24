-- db/023_add_polygon_label_color.sql
--
-- Background color of a zone's own plot-number badge (db/019's show_label
-- feature) -- independent of fill/border/hover color, same picker pattern
-- (palette + color wheel) as those three. Nullable: null means the original
-- neutral light pill (white-ish background, dark text), matching how every
-- zone's badge already looked before this was configurable, so no existing
-- zone changes appearance. A non-null value switches the badge to that
-- color with white text (the app's whole preset palette reads fine with
-- white text; only a deliberately very light custom pick from the color
-- wheel would read poorly, the same tradeoff fill/border/hover already
-- accept for their own presets).
--
-- See lib/polygons.js's normalizeLabelColor, and the zoneLabelMarkers
-- builders in middle.jsx / export.jsx, which this column feeds.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

alter table public.polygons
    add column if not exists label_color text;
