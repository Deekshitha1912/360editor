-- db/019_add_polygon_show_label.sql
--
-- Whether this zone's own label is drawn on the panorama as an always-visible
-- badge at its centre, the way a plot map shows a number in every plot --
-- rather than only appearing in the card after a click, which is all a zone's
-- label did before.
--
-- Default true so an existing tour's zones start showing their labels, which
-- is the whole point of the feature; a zone with an empty label renders no
-- badge regardless, so nothing appears for zones that were never named. Turn
-- it off per zone from the zone form to hide one without clearing its label.
-- See the zoneLabelMarkers builders in middle.jsx / export.jsx.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

alter table public.polygons
    add column if not exists show_label boolean not null default true;
