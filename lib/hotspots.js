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

// Widened from the original 40-400 range specifically so a 'siteplan' decal
// (a real 3D imageLayer plane, scaled by FLOOR_SIZE_MULTIPLIER against the
// sphere radius — see lib/arrows.js) can be dragged large enough to cover a
// whole plot, and small enough for a tight close-up crop — shared across
// every hotspot type rather than a siteplan-only range, since floor/text/
// pulse/custom all resize through this exact same clamp and gizmo math.
export const HOTSPOT_SIZE_MIN = 15
export const HOTSPOT_SIZE_MAX = 1200
// A site plan usually has to span a whole plot, far beyond any marker.
export const SITEPLAN_SIZE_MAX = HOTSPOT_SIZE_MAX * 10

export function maxSizeFor(arrowType) {
    return arrowType === 'siteplan' ? SITEPLAN_SIZE_MAX : HOTSPOT_SIZE_MAX
}

export function clampHotspotSize(v, arrowType) {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    if (!Number.isFinite(n)) return null
    return Math.min(maxSizeFor(arrowType), Math.max(HOTSPOT_SIZE_MIN, Math.round(n * 100) / 100))
}

export function clampHotspotRotation(v) {
    const n = Number(v)
    if (!Number.isFinite(n)) return 0
    return Math.round((((n + 180) % 360 + 360) % 360 - 180) * 100) / 100
}

// The 'floor' hotspot's other two rotation axes (X/pitch, Y/yaw — the
// existing `rotation` column above is reused as the third, Z/roll). Same
// wrap-into-±180 behavior as clampHotspotRotation, just with a per-call
// fallback since, unlike rotation's universal 0, X defaults to 90° (so a
// freshly-placed floor decal starts lying flat) while Y defaults to 0°.
export function clampHotspotAngle(v, fallback = 0) {
    const n = Number(v)
    if (!Number.isFinite(n)) return fallback
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

// Paint order for overlapping hotspots — lower draws first (underneath),
// same concept and same bound as lib/polygons.js's own normalizeZIndex/
// MAX_Z_INDEX (kept as a separate copy rather than a cross-import, since
// hotspots and zones are otherwise independent tables/normalizers).
export const MAX_Z_INDEX = 99

export function normalizeZIndex(v) {
    const n = Number(v)
    if (!Number.isFinite(n)) return 0
    return Math.min(MAX_Z_INDEX, Math.max(-MAX_Z_INDEX, Math.round(n)))
}

// Bounds a 'siteplan' hotspot's parsed DXF geometry (lib/dxf.js's
// dxfTextToShapes() output) before it's ever written — same reasoning as
// every other user-supplied jsonb blob in this app: cap it so one hotspot
// can't carry an unbounded payload. A malformed/oversized value is dropped
// entirely (returns null, meaning "no plan") rather than truncated, since a
// silently-truncated DXF would trace as a plausible-looking but wrong shape.
// Sized for real site plans (thousands of separate LINE entities is normal);
// the editor checks the same limits at import time so an oversized file is
// rejected with a message there, never silently nulled here.
export const MAX_PLAN_SHAPES = 10000
export const MAX_PLAN_POINTS = 100000
export const MAX_PLAN_LABELS = 5000

export function normalizePlanShapes(raw) {
    if (!raw || typeof raw !== 'object') return null
    const { shapes, bbox } = raw
    if (!Array.isArray(shapes) || shapes.length === 0 || shapes.length > MAX_PLAN_SHAPES) return null
    if (!bbox || typeof bbox !== 'object') return null
    const { minX, minY, maxX, maxY } = bbox
    if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null

    let totalPoints = 0
    const cleanShapes = []
    for (const shape of shapes) {
        if (!shape || (shape.tag !== 'polyline' && shape.tag !== 'polygon') || !Array.isArray(shape.pts)) return null
        const pts = shape.pts.filter(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))
        if (pts.length < 2) continue
        totalPoints += pts.length
        if (totalPoints > MAX_PLAN_POINTS) return null
        cleanShapes.push({ tag: shape.tag, pts })
    }
    if (!cleanShapes.length) return null
    if (!(maxX > minX && maxY > minY)) return null

    // originalBbox is the full imported extent; bbox is the (possibly
    // cropped) window actually rendered. Plans saved before cropping existed
    // have no originalBbox, so their bbox is the full extent.
    const o = raw.originalBbox
    const originalBbox = o && [o.minX, o.minY, o.maxX, o.maxY].every(Number.isFinite) && o.maxX > o.minX && o.maxY > o.minY
        ? { minX: o.minX, minY: o.minY, maxX: o.maxX, maxY: o.maxY }
        : { minX, minY, maxX, maxY }

    // Whole-decal opacity, kept in this blob rather than a column of its own.
    const op = Number(raw.opacity)
    const opacity = Number.isFinite(op) ? Math.min(1, Math.max(0.05, Math.round(op * 100) / 100)) : 1

    // Held exactly flat on the ground unless explicitly turned off (see
    // lib/arrows.js's planRenderRotation).
    const flat = raw.flat !== false
    // Fine corrections on top of flat (lib/arrows.js planRenderRotation /
    // planStretch): small tilts in degrees and per-axis stretch factors.
    const num = (v, lo, hi, dflt) => {
        const n = Number(v)
        return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n * 1000) / 1000)) : dflt
    }
    const tiltX = num(raw.tiltX, -10, 10, 0), tiltY = num(raw.tiltY, -10, 10, 0)
    const stretchX = num(raw.stretchX, 0.5, 2, 1), stretchY = num(raw.stretchY, 0.5, 2, 1)

    // Anchor pin, as a position within the drawing (u across, v down, 0..1;
    // a little outside is allowed). Editor-only: it's what reshaping
    // pivots around.
    const a = raw.anchor
    const anchor = a && Number.isFinite(Number(a.u)) && Number.isFinite(Number(a.v))
        ? { u: num(a.u, -1, 2, 0.5), v: num(a.v, -1, 2, 0.5) }
        : null

    // Text labels from the DXF (plot numbers — lib/dxf.js collectLabels),
    // used to name plot zones. Invalid entries are dropped individually; they
    // never invalidate the plan itself.
    const labels = Array.isArray(raw.labels)
        ? raw.labels.slice(0, MAX_PLAN_LABELS).flatMap(l => {
            const x = Number(l?.x), y = Number(l?.y), text = typeof l?.text === 'string' ? l.text.trim().slice(0, 16) : ''
            return Number.isFinite(x) && Number.isFinite(y) && text
                ? [{ x, y, text, layer: typeof l.layer === 'string' ? l.layer.slice(0, 40) : '' }]
                : []
        })
        : []

    return { shapes: cleanShapes, bbox: { minX, minY, maxX, maxY }, originalBbox, opacity, flat, tiltX, tiltY, stretchX, stretchY, anchor, labels }
}

// "What a click does" (action_type/link_url/info_body/etc.) moved to
// lib/actions.js once zones grew the exact same fields — re-exported here
// so existing `import { normalizeActionType } from '@/lib/hotspots'` call
// sites keep working without churn.
export { ACTION_TYPES as HOTSPOT_ACTION_TYPES, normalizeActionType, clampText } from '@/lib/actions'
