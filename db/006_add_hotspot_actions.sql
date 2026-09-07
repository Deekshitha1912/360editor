-- db/006_add_hotspot_actions.sql
-- Decouples a hotspot's click ACTION from its glyph (arrow_type). Until now
-- every hotspot only ever did one thing on click: navigate to
-- target_scene_id if set, nothing otherwise. action_type generalizes that
-- into 4 kinds: navigate (existing behavior, now explicit), link (open a
-- URL/mailto:/tel:), info (a text+image card, shown via PSV's own marker
-- content panel), toggle (show/hide another hotspot in the same scene).
-- Idempotent — apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

alter table public.hotspots
    add column if not exists action_type      text not null default 'navigate',
    add column if not exists link_url         text,
    add column if not exists info_body        text,
    add column if not exists info_image_url   text,
    add column if not exists toggle_target_id uuid references public.hotspots(id) on delete set null,
    add column if not exists start_hidden     boolean not null default false;

alter table public.hotspots
    drop constraint if exists hotspots_action_type_check;

alter table public.hotspots
    add constraint hotspots_action_type_check
        check (action_type in ('navigate', 'link', 'info', 'toggle'));
