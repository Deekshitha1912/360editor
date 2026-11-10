-- db/029_tour_ui_fields.sql
--
-- Fields for the redesigned published tour (project badge, Call / Location /
-- Enquiry buttons, Top view button, landmark callouts):
--   projects.location_subtitle  "Poonthandalam · ECR, Chennai" under the name
--   projects.contact_phone      Call button (tel:)
--   projects.whatsapp_number    Enquiry button (wa.me)
--   projects.maps_url           Location button (any map link)
--   scenes.top_yaw/pitch/hfov   saved "top view" the Top view button flies to
--   hotspots.sublabel           landmark callout's pill, e.g. "18 min"
-- All nullable; an empty field hides its button / pill.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

alter table public.projects
    add column if not exists location_subtitle text,
    add column if not exists contact_phone     text,
    add column if not exists whatsapp_number   text,
    add column if not exists maps_url          text;

alter table public.scenes
    add column if not exists top_yaw   double precision,
    add column if not exists top_pitch double precision,
    add column if not exists top_hfov  double precision;

alter table public.hotspots
    add column if not exists sublabel text;
