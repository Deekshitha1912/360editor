-- db/004_add_hotspot_label_color.sql
-- Adds a separate color for the landmark hotspot's label background (the
-- box behind the text), independent of hotspots.color (which tints the
-- stick+dot). Nullable — null means "use the default near-black". Idempotent.

alter table hotspots add column if not exists label_color text;
