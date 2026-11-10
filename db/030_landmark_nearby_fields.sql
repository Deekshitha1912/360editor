-- db/030_landmark_nearby_fields.sql
--
-- Extra landmark details for the tour's "Nearby landmarks" panel:
--   hotspots.description    short paragraph on the landmark's card
--   hotspots.distance_text  e.g. "11.8 km NE · straight line"
--   hotspots.route_url      map link behind the card's Route button
-- All nullable; an empty field just isn't shown.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

alter table public.hotspots
    add column if not exists description   text,
    add column if not exists distance_text text,
    add column if not exists route_url     text;
