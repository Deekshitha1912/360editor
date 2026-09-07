-- db/012_add_action_image_and_info_fields.sql
--
-- Two additions to the shared hotspot/zone click-action system
-- (db/006_add_hotspot_actions.sql, db/007_add_polygon_actions.sql):
--
-- 1. A new action_type value, 'image' -- clicking opens info_image_url
--    full-screen in a lightbox (see export.jsx's showImageLightbox), rather
--    than reusing 'info' for a single bare picture.
-- 2. info_fields -- the 'info' action's card content is now a user-built
--    list of {type: 'text'|'image'|'link', label, value} entries instead of
--    one fixed body/info_image_url/link_url shape, so a card can carry any
--    mix of several text blocks, images, and links, in any order. The old
--    info_body/info_image_url/link_url columns stay (info_image_url is
--    reused by the new 'image' action, link_url by the existing 'link'
--    action) -- only what the 'info' action itself renders from has
--    changed, in application code, not the schema.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same
-- as every prior migration in this file (no migration runner exists).

alter table public.hotspots
    add column if not exists info_fields jsonb not null default '[]'::jsonb;

alter table public.polygons
    add column if not exists info_fields jsonb not null default '[]'::jsonb;

alter table public.hotspots
    drop constraint if exists hotspots_action_type_check;
alter table public.hotspots
    add constraint hotspots_action_type_check
        check (action_type in ('navigate', 'link', 'info', 'toggle', 'image'));

alter table public.polygons
    drop constraint if exists polygons_action_type_check;
alter table public.polygons
    add constraint polygons_action_type_check
        check (action_type in ('navigate', 'link', 'info', 'toggle', 'image'));
