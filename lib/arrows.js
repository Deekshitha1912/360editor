// lib/arrows.js
// The arrow sprite table — plain data, NO 'use client'.
//
// This lives outside the components tree because the public tour route
// (app/[userId]/[slug]/route.js) renders the tour on the server and needs it.
// A 'use client' module's exports become client references when imported from
// server code, so ARROWS had to move out of hotspot_panel.jsx.
// hotspot_panel.jsx re-exports it, so existing imports keep working.

const STORAGE = 'https://dtmbvliwbvnjnewkohcn.supabase.co/storage/v1/object/public/hotspots'

export const ARROWS = [
    { type: 'up',       jpg: `${STORAGE}/arrow_up.jpg`,       gif: `${STORAGE}/arrow_up.gif`,       label: 'Forward' },
    { type: 'left',     jpg: `${STORAGE}/arrow_left.jpg`,     gif: `${STORAGE}/arrow_left.gif`,     label: 'Left'    },
    { type: 'up-left',  jpg: `${STORAGE}/arrow_left_up.jpg`,  gif: `${STORAGE}/arrow_left_up.gif`,  label: 'Fwd-L'   },
    { type: 'up-right', jpg: `${STORAGE}/arrow_right_up.jpg`, gif: `${STORAGE}/arrow_right_up.gif`, label: 'Fwd-R'   },
]