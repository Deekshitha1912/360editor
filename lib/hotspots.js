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
