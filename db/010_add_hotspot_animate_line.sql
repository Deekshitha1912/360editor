-- db/010_add_hotspot_animate_line.sql
-- Per-landmark toggle for the "grow in" line animation (published tour only
-- -- see export.jsx's _updateLandmarkAnim): when on, the landmark's stick
-- starts collapsed (scaleY(0), anchored at the bottom dot) and animates up
-- to full height the moment the camera pans it into view, replaying every
-- time it leaves and re-enters view. Meaningless for every other
-- arrow_type (only landmark has a stick to animate), but not worth a check
-- constraint over -- same "harmless if unused" precedent as hotspots'
-- rotate_x/rotate_y on non-floor types.
--
-- Defaults true: the feature reads as "on by default, opt out per hotspot"
-- rather than something you have to discover and turn on.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same
-- as every prior migration in this file (no migration runner exists).

alter table public.hotspots add column if not exists animate_line boolean not null default true;
