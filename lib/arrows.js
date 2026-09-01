// lib/arrows.js
// The arrow sprite table — plain data, NO 'use client'.
//
// This lives outside the components tree because the public tour route
// (app/[userId]/[slug]/route.js) renders the tour on the server and needs it.
// A 'use client' module's exports become client references when imported from
// server code, so ARROWS had to move out of hotspot_panel.jsx.
// hotspot_panel.jsx re-exports it, so existing imports keep working.

const STORAGE = 'https://dtmbvliwbvnjnewkohcn.supabase.co/storage/v1/object/public/hotspots'

// Floor-circle marker — the "step here" style seen in 3DVista/Matterport-style
// tours, offered alongside the directional arrows. No sprite asset exists for
// it, so it's drawn as an inline SVG (indigo disc, white ring for contrast
// against any floor, lime pulse ring) and encoded as a data: URI instead.
// That makes it a plain, valid image value — every place that already reads
// arrow.jpg/arrow.gif (the palette tile, the popup icon, the drag pin, both
// viewer marker builders) picks it up with zero other changes. The pulse uses
// SVG's own <animate> tags rather than a CSS class, because CSS animations on
// an SVG referenced via <img src="data:..."> don't run, but the SVG's own
// native animation directives do.
const CIRCLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
    + '<circle cx="50" cy="50" r="34" fill="#3730a3" fill-opacity="0.88"/>'
    + '<circle cx="50" cy="50" r="34" fill="none" stroke="#ffffff" stroke-width="4"/>'
    + '<circle cx="50" cy="50" r="34" fill="none" stroke="#a3e635" stroke-width="2.5">'
    + '<animate attributeName="r" values="34;47;34" dur="2s" repeatCount="indefinite"/>'
    + '<animate attributeName="opacity" values="0.9;0;0.9" dur="2s" repeatCount="indefinite"/>'
    + '</circle></svg>'
const CIRCLE_DATA_URI = `data:image/svg+xml,${encodeURIComponent(CIRCLE_SVG)}`

export const ARROWS = [
    { type: 'up',       jpg: `${STORAGE}/arrow_up.jpg`,       gif: `${STORAGE}/arrow_up.gif`,       label: 'Forward' },
    { type: 'left',     jpg: `${STORAGE}/arrow_left.jpg`,     gif: `${STORAGE}/arrow_left.gif`,     label: 'Left'    },
    { type: 'up-left',  jpg: `${STORAGE}/arrow_left_up.jpg`,  gif: `${STORAGE}/arrow_left_up.gif`,  label: 'Fwd-L'   },
    { type: 'up-right', jpg: `${STORAGE}/arrow_right_up.jpg`, gif: `${STORAGE}/arrow_right_up.gif`, label: 'Fwd-R'   },
    { type: 'circle',   jpg: CIRCLE_DATA_URI,                 gif: CIRCLE_DATA_URI,                 label: 'Floor marker' },
]