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

// Landmark marker — a krpano-style vertical line rising from the real 3D
// point to a floating, always-visible label, with a pulsing dot at the base.
// Unlike the circle above, this ISN'T what actually renders in the scene: the
// floating label has to show each hotspot's own text, which isn't known until
// render time, so the real marker is built per-hotspot as a PSV `html` marker
// (see middle.jsx's arrowMarkers builder and export.jsx's arrowMarker()). This
// SVG is only a static preview glyph — the palette tile and the popup's small
// icon, both of which just do <img src={arrow.gif}> today — so it doesn't
// need to move or pulse.
const LANDMARK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
    + '<rect x="16" y="8" width="68" height="24" rx="7" fill="#3730a3"/>'
    + '<rect x="46" y="32" width="8" height="38" rx="4" fill="#3730a3"/>'
    + '<circle cx="50" cy="78" r="11" fill="#3730a3" stroke="#ffffff" stroke-width="3"/>'
    + '</svg>'
const LANDMARK_DATA_URI = `data:image/svg+xml,${encodeURIComponent(LANDMARK_SVG)}`

// Floor decal — a genuinely surface-embedded marker (PSV `imageLayer`, a real
// 3D-oriented plane placed as a single point + a full yaw/pitch/roll
// rotation — see middle.jsx's arrowMarkers builder and export.jsx's
// duplicate), not a billboard like every other arrow type: it warps with
// perspective and reads as stuck to the surface instead of a flat sticker
// facing the camera. Unlike the other SVGs above, this one is NOT only a
// flat preview glyph — it's also loaded as an actual WebGL texture for the
// real 3D marker, which is why, unlike them, it needs explicit width/height
// attributes (not just viewBox): a <img> tag happily uses whatever size the
// surrounding CSS/config gives it regardless of intrinsic size, but
// three.js's texture loader reads the image's own natural width/height to
// allocate GPU texture storage, and a viewBox-only SVG often reports an
// unusable (sometimes 0×0) intrinsic size in that context — the texture
// upload then fails ("bad image data" / "texture is immutable" in the
// console) and the marker exists, positioned correctly, with no visible
// texture at all. A plain flat 2D ring — a genuine circle (not an ellipse
// simulating floor perspective, and no drop-shadow/3D treatment), white
// with the small center circle left empty/transparent, same "two concentric
// circles" shape as the CIRCLE_SVG billboard above. stroke-opacity 0.8, not
// fully solid — a plain 100%-opaque white ring read as too stark/glowy.
const FLOOR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">'
    + '<circle cx="50" cy="50" r="30" fill="none" stroke="#ffffff" stroke-opacity="0.8" stroke-width="16"/>'
    + '</svg>'
const FLOOR_DATA_URI = `data:image/svg+xml,${encodeURIComponent(FLOOR_SVG)}`

// Floor decal's `size` (40-400, same slider/drag range as every pixel-based
// arrow type) isn't consumed in pixels — PSV's imageLayer marker treats it as
// a 3D world-scale factor (size/100) against the fixed sphere radius (10), so
// the exact same numeric range that reads as "small, then medium, then big"
// for a screen-space sprite like pulse ring reads as a barely-there sliver at
// the low end and still fairly modest at the high end once actually rendered
// on the sphere. This multiplier is applied ONLY where that size feeds the
// real imageLayer marker (middle.jsx's mainLoop preview + arrowMarkers
// builder, export.jsx's arrowMarker) — never to the raw draggable `size`
// value itself, so the on-canvas resize handles keep the exact same feel as
// every other type. It's an empirical starting point, not a derived
// constant — tune it up/down based on how the decal actually looks live.
// export.jsx can't import this (its arrowMarker() ships as a plain string
// inside the published tour's own inline <script>), so its copy of this
// number has to be kept in sync by hand.
export const FLOOR_SIZE_MULTIPLIER = 2.5

// Pulse ring — the same flat 2D ring as the floor decal above, but a plain
// billboard (like CIRCLE_SVG, not a surface-embedded imageLayer marker) with
// its radius gently animating — a soft "breathing" ring rather than the
// floor decal's static one. Reuses the exact SVG-<animate> approach
// CIRCLE_SVG already established (CSS animations on an SVG referenced via
// <img src="data:...">/a WebGL texture don't run, but the SVG's own native
// animation directives do) — and because it's a billboard like every other
// non-floor arrow type, it needs ZERO marker-builder changes in middle.jsx/
// export.jsx: it falls straight into the existing generic `image` branch.
const PULSE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
    + '<circle cx="50" cy="50" r="30" fill="none" stroke="#ffffff" stroke-opacity="0.8" stroke-width="16">'
    + '<animate attributeName="r" values="27;33;27" dur="2.4s" repeatCount="indefinite"/>'
    + '</circle></svg>'
const PULSE_DATA_URI = `data:image/svg+xml,${encodeURIComponent(PULSE_SVG)}`

// Custom image marker — a plain billboard exactly like `pulse`/every
// directional arrow (falls into the same generic `image` branch in both
// marker builders, ZERO marker-builder changes needed for the marker itself
// beyond swapping which URL it renders), except the glyph is a user-uploaded
// image (hotspot.custom_icon_url) instead of one of the fixed sprites above.
// This SVG is only the placeholder shown before that upload happens — the
// palette tile, and the live marker/pin-box preview until custom_icon_url is
// actually set.
const CUSTOM_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
    + '<rect x="10" y="18" width="80" height="64" rx="10" fill="#3730a3" fill-opacity="0.15" stroke="#3730a3" stroke-width="4"/>'
    + '<circle cx="34" cy="40" r="8" fill="#3730a3"/>'
    + '<path d="M18 70l22-22 14 14 10-10 18 18" fill="none" stroke="#3730a3" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</svg>'
const CUSTOM_DATA_URI = `data:image/svg+xml,${encodeURIComponent(CUSTOM_SVG)}`

export const ARROWS = [
    { type: 'up',       jpg: `${STORAGE}/arrow_up.jpg`,       gif: `${STORAGE}/arrow_up.gif`,       label: 'Forward' },
    { type: 'left',     jpg: `${STORAGE}/arrow_left.jpg`,     gif: `${STORAGE}/arrow_left.gif`,     label: 'Left'    },
    { type: 'up-left',  jpg: `${STORAGE}/arrow_left_up.jpg`,  gif: `${STORAGE}/arrow_left_up.gif`,  label: 'Fwd-L'   },
    { type: 'up-right', jpg: `${STORAGE}/arrow_right_up.jpg`, gif: `${STORAGE}/arrow_right_up.gif`, label: 'Fwd-R'   },
    { type: 'circle',   jpg: CIRCLE_DATA_URI,                 gif: CIRCLE_DATA_URI,                 label: 'Floor marker' },
    { type: 'landmark', jpg: LANDMARK_DATA_URI,               gif: LANDMARK_DATA_URI,               label: 'Landmark' },
    { type: 'floor',    jpg: FLOOR_DATA_URI,                  gif: FLOOR_DATA_URI,                  label: 'Floor decal' },
    { type: 'pulse',    jpg: PULSE_DATA_URI,                  gif: PULSE_DATA_URI,                  label: 'Pulse ring' },
    { type: 'custom',   jpg: CUSTOM_DATA_URI,                 gif: CUSTOM_DATA_URI,                 label: 'Custom image' },
]