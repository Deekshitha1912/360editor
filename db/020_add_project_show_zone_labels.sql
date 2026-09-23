-- db/020_add_project_show_zone_labels.sql
--
-- Tour-wide master switch for the plot-number badges db/019 added per zone.
-- Without it, turning the numbers off for a site plan carrying 150+ plots
-- meant opening every zone's form and unticking each one.
--
-- ANDed with the per-zone polygons.show_label at render time: this column
-- turns the whole layer off, the per-zone flag stays the per-plot exception
-- ("hide just this one"). Default true so nothing changes for a tour that
-- already has its labels the way it wants them.
--
-- Note there is deliberately NO column for the zoom threshold that also
-- hides labels when zoomed out -- that one needs no setting, because it
-- measures each zone's own projected size on screen and shows the badge
-- only when the plot is actually big enough to hold it. See the
-- zoneLabelMarkers builders in middle.jsx / export.jsx.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

alter table public.projects
    add column if not exists show_zone_labels boolean not null default true;
