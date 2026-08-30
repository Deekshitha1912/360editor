-- db/001_create_polygons.sql
--
-- Status-driven polygon zone overlays, anchored in spherical coordinates on a
-- scene's panorama (degrees, matching hotspots.pitch/yaw's existing
-- convention). Used to mark real-estate units/zones as available/booked/etc,
-- with an admin-editable status, label, and a free-form "detail" payload shown
-- on click.
--
-- Ownership mirrors hotspots: polygons -> scenes -> projects -> auth.users.
-- Own table (not a JSON array column like projects.overlays/coverups) because
-- status is expected to be toggled independently and often, which fits a real
-- PATCH-by-id row update far better than resaving a whole array every time.
--
-- Deliberately cascades on delete from BOTH scenes and projects — stricter
-- than the existing un-cascaded `hotspots` table (see README "Known cleanup
-- items"). Don't loosen this to match; it's a deliberate improvement.
--
-- No repo-tracked migration runner exists for this project — every prior
-- schema change was applied by hand against the live Supabase project via the
-- SQL editor or CLI and never committed. Apply this file the same way:
-- dev/staging first, then production. This file (and this db/ folder) is the
-- first step toward tracking schema changes in git going forward.

create table if not exists public.polygons (
    id           uuid primary key default gen_random_uuid(),
    project_id   uuid not null references public.projects(id) on delete cascade,
    scene_id     uuid not null references public.scenes(id)   on delete cascade,
    points       jsonb not null,              -- [[yaw_deg, pitch_deg], ...], >= 3 pairs
    status       text  not null default 'available',
    label        text  not null default '',
    detail       jsonb not null default '{}'::jsonb,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),

    constraint polygons_points_is_array check (jsonb_typeof(points) = 'array'),
    constraint polygons_status_len      check (char_length(status) <= 32),
    constraint polygons_label_len       check (char_length(label)  <= 120)
);

create index if not exists polygons_scene_id_idx   on public.polygons(scene_id);
create index if not exists polygons_project_id_idx on public.polygons(project_id);

alter table public.polygons enable row level security;

-- Read: the owning project's user only.
create policy polygons_select on public.polygons
    for select
    using (
        exists (
            select 1 from public.projects p
            where p.id = polygons.project_id and p.user_id = auth.uid()
        )
    );

-- Insert: project must belong to the caller, AND the scene must belong to
-- that same project — the same two-part check app/api/hotspots/route.js does
-- server-side, enforced again here at the database level.
create policy polygons_insert on public.polygons
    for insert
    with check (
        exists (
            select 1 from public.projects p
            where p.id = polygons.project_id and p.user_id = auth.uid()
        )
        and exists (
            select 1 from public.scenes s
            where s.id = polygons.scene_id and s.project_id = polygons.project_id
        )
    );

-- Update: both USING (which existing rows can be targeted) and WITH CHECK
-- (what the row is allowed to look like afterward) are required — a policy
-- with only USING lets an update silently affect 0 rows instead of erroring,
-- which is exactly the class of bug documented in
-- app/api/projects/[id]/route.js's PATCH handler for the projects table.
create policy polygons_update on public.polygons
    for update
    using (
        exists (
            select 1 from public.projects p
            where p.id = polygons.project_id and p.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from public.projects p
            where p.id = polygons.project_id and p.user_id = auth.uid()
        )
    );

-- Delete: same ownership check.
create policy polygons_delete on public.polygons
    for delete
    using (
        exists (
            select 1 from public.projects p
            where p.id = polygons.project_id and p.user_id = auth.uid()
        )
    );
