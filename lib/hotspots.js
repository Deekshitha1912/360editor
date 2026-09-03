// lib/hotspots.js
//
// Validates the two per-hotspot transform fields (size, rotation). Mirrors
// lib/overlays.js's clamp style and lib/polygons.js's wrap-into-range style.
//
// size — nullable. null means "no override, follow the tour-wide
//        hotspot_size slider on the project" — exactly today's behavior for
//        every hotspot that has never been individually resized. It only
//        becomes a real number once a user drags that specific hotspot's
//        resize handle (or its Size slider), decoupling it from the shared
//        slider from then on.
// rotation — always a real number, defaults to 0. No shared "tour rotation"
//            concept exists, so unlike size this never needs to stay null.

export const HOTSPOT_SIZE_MIN = 40
export const HOTSPOT_SIZE_MAX = 400

export function clampHotspotSize(v) {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    if (!Number.isFinite(n)) return null
    return Math.min(HOTSPOT_SIZE_MAX, Math.max(HOTSPOT_SIZE_MIN, Math.round(n * 100) / 100))
}

export function clampHotspotRotation(v) {
    const n = Number(v)
    if (!Number.isFinite(n)) return 0
    return Math.round((((n + 180) % 360 + 360) % 360 - 180) * 100) / 100
}

// Preset palette offered for the landmark hotspot style (stick+dot tint
// together). Not an enum in the DB — color is a plain hex string column,
// this list just curates what the popup's swatches offer.
export const HOTSPOT_COLORS = ['#3730a3', '#dc2626', '#16a34a', '#d97706', '#db2777', '#0284c7']
export const DEFAULT_HOTSPOT_COLOR = HOTSPOT_COLORS[0]

// Separate palette for the label's own background (the box behind the text)
// — starts with the original near-black default, since "keep it black" is a
// valid, common choice, then offers the same accent set for a fully-tinted
// look.
export const LABEL_COLORS = ['#14141a', ...HOTSPOT_COLORS]
export const DEFAULT_LABEL_COLOR = LABEL_COLORS[0]

const HEX_RE = /^#[0-9a-f]{6}$/i

// null/invalid falls back to the default rather than being rejected — a
// stray or malformed value shouldn't block saving the rest of the hotspot.
export function normalizeHotspotColor(v) {
    return typeof v === 'string' && HEX_RE.test(v) ? v : DEFAULT_HOTSPOT_COLOR
}

export function normalizeLabelColor(v) {
    return typeof v === 'string' && HEX_RE.test(v) ? v : DEFAULT_LABEL_COLOR
}
