-- db/007_add_polygon_actions.sql
-- Gives zones the exact same click-action system hotspots already have
-- (db/006_add_hotspot_actions.sql): action_type decouples WHAT a click does
-- from the zone's own status/label/detail, which stay independent, always-
-- shown zone properties (status still drives the shape's fill color
-- regardless of what its click does).
--
-- action_type defaults to 'info', not 'navigate' like hotspots' own default
-- — a zone's pre-existing implicit behavior was ALWAYS "show the status/
-- detail card", so defaulting to 'info' here needs zero backfill, the same
-- "default = whatever it already did" rule hotspots' migration used.
--
-- target_scene_id is new (zones couldn't navigate at all before this);
-- toggle_target_id points at a hotspot, same as hotspots' own toggle target
-- (not another zone) — the simplest, most consistent option given hotspots'
-- toggle already works this exact way.
--
-- Idempotent — apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

alter table public.polygons
    add column if not exists action_type      text not null default 'info',
    add column if not exists target_scene_id  uuid references public.scenes(id) on delete set null,
    add column if not exists link_url         text,
    add column if not exists info_body        text,
    add column if not exists info_image_url   text,
    add column if not exists toggle_target_id uuid references public.hotspots(id) on delete set null,
    add column if not exists start_hidden     boolean not null default false;

alter table public.polygons
    drop constraint if exists polygons_action_type_check;

alter table public.polygons
    add constraint polygons_action_type_check
        check (action_type in ('navigate', 'link', 'info', 'toggle'));
