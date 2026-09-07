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
// panel — see export.jsx's arrowMarker/zoneMarker) built from info_fields,
// 'toggle' = show/hide another hotspot, 'image' = open info_image_url
// full-screen in a lightbox (see export.jsx's showImageLightbox).

export const ACTION_TYPES = ['navigate', 'link', 'info', 'toggle', 'image']

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

// The 'info' action's card content — a user-built list of fields instead of
// one fixed body/image/link shape, so a card can carry any mix of several
// text blocks, images, and links, in whatever order they were added.
// info_body/info_image_url stay on the table (info_image_url is reused by
// the separate 'image' action) but 'info' itself renders from this array
// alone now.
export const INFO_FIELD_TYPES = ['text', 'image', 'link']
export const MAX_INFO_FIELDS = 12
const MAX_INFO_FIELD_LABEL_LEN = 200
const MAX_INFO_FIELD_VALUE_LEN = 2000

// A field with no value is dropped — an empty text block, unset image, or
// blank link has nothing to show, so there's no reason to persist it (same
// "only keep what's actually filled in" rule lib/polygons.js's
// normalizeDetail applies to detail rows).
export function normalizeInfoFields(raw) {
    if (!Array.isArray(raw)) return []
    return raw
        .slice(0, MAX_INFO_FIELDS)
        .map(f => ({
            type:  INFO_FIELD_TYPES.includes(f?.type) ? f.type : 'text',
            label: typeof f?.label === 'string' ? f.label.trim().slice(0, MAX_INFO_FIELD_LABEL_LEN) : '',
            value: typeof f?.value === 'string' ? f.value.trim().slice(0, MAX_INFO_FIELD_VALUE_LEN) : '',
        }))
        .filter(f => f.value)
}
