-- db/003_add_hotspot_color.sql
-- Adds a per-hotspot color, used by the landmark hotspot style (stick+dot+
-- label all tint together). Nullable — null means "use the default indigo",
-- same "no override yet" convention as hotspots.size. Idempotent so it's
-- safe to re-run.

alter table hotspots add column if not exists color text;
