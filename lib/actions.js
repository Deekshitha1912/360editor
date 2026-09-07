// lib/actions.js
//
// What a click actually does — shared vocabulary between hotspots and
// polygon zones, both of which carry the exact same action_type/link_url/
// info_body/info_image_url/toggle_target_id/start_hidden columns. Used to
// live in lib/hotspots.js (hotspots had it first), split out once zones
// grew the identical fields so a file named "hotspots" wasn't the thing
// zones' API routes imported from.
//
// 'navigate' = go to another scene, 'link' = open a URL/mailto:/tel:,
// 'info' = show a content card (Photo Sphere Viewer's own built-in marker
// panel — see export.jsx's arrowMarker/zoneMarker), 'toggle' = show/hide
// another hotspot.

export const ACTION_TYPES = ['navigate', 'link', 'info', 'toggle']

// fallback lets each caller default to whatever ITS pre-existing implicit
// behavior already was, so adding this column needs zero backfill: hotspots
// only ever navigated (fallback 'navigate'), zones only ever showed their
// status/detail card (fallback 'info').
export function normalizeActionType(v, fallback = 'navigate') {
    return ACTION_TYPES.includes(v) ? v : fallback
}

// Free-text fields (link_url, info_body) — just trim + cap length, no format
// validation. A malformed URL or empty body isn't this layer's problem to
// solve; it just shouldn't be allowed to grow unbounded.
export function clampText(v, maxLen) {
    if (typeof v !== 'string') return null
    const trimmed = v.trim()
    return trimmed ? trimmed.slice(0, maxLen) : null
}
