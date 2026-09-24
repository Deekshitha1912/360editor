// lib/polygons.js
//
// Validation for polygon zone overlays — mirrors lib/overlays.js's approach,
// but polygons live as individual DB rows (own table, own API routes), not a
// JSON array column on `projects`, so these normalizers validate ONE polygon's
// incoming fields per call rather than a whole array at once. See
// db/001_create_polygons.sql for the table shape these match.
//
// Never trust the client's shape — every write goes through these before
// touching the database.

export const MIN_POLYGON_VERTICES  = 3
export const MAX_POLYGON_VERTICES  = 24
export const MAX_POLYGONS_PER_SCENE = 60
export const MAX_LABEL_LEN         = 120
export const MAX_DETAIL_KEYS       = 20
export const MAX_DETAIL_JSON_LEN   = 4000
export const MAX_EDGE_LABEL_LEN    = 24

// Colors are keyed by status; anything not in this list (including a
// free-form custom status) falls back to DEFAULT_STATUS_COLOR rather than
// being rejected — status is meant to stay open-ended.
export const STATUS_COLORS = {
    available: '#22c55e',
    booked:    '#ef4444',
    reserved:  '#f59e0b',
}
export const DEFAULT_STATUS_COLOR = '#6366f1'

// Palette offered for both the fill and border color pickers — same accent
// set hotspots' landmark style already offers, plus black/white so either
// picker can produce a genuinely neutral zone, not just app-accent hues.
// Each picker also offers a raw <input type="color"> wheel alongside this
// palette, for anything outside these presets.
export const CUSTOM_STATUS_COLORS = ['#6366f1', '#3730a3', '#dc2626', '#16a34a', '#d97706', '#db2777', '#0284c7', '#000000', '#ffffff']

const HEX_RE = /^#[0-9a-f]{6}$/i

// customColor, when a valid hex string, overrides ANY status's fill color —
// preset (available/booked/reserved) or custom (free-form) alike — so every
// zone's fill is individually customizable, not just custom-status ones.
// Leaving it unset (null) falls back to a preset status's own fixed color,
// or DEFAULT_STATUS_COLOR for a custom one.
export function colorForStatus(status, customColor) {
    if (typeof customColor === 'string' && HEX_RE.test(customColor)) return customColor
    return STATUS_COLORS[status] || DEFAULT_STATUS_COLOR
}

// A zone's border (stroke) color — independent of its fill color above.
// null/unset means "same as fill", matching how borders looked before this
// was configurable (the stroke was always just the resolved fill color).
export function normalizeBorderColor(v) {
    return typeof v === 'string' && HEX_RE.test(v) ? v : null
}

export function borderColorFor(fillColor, borderColor) {
    return typeof borderColor === 'string' && HEX_RE.test(borderColor) ? borderColor : fillColor
}

// The fill color used while the pointer is over the zone. Same null-means-
// "same as fill" convention as the border above, which is exactly what
// hovering did before it was configurable.
export function normalizeHoverColor(v) {
    return typeof v === 'string' && HEX_RE.test(v) ? v : null
}

export function hoverColorFor(fillColor, hoverColor) {
    return typeof hoverColor === 'string' && HEX_RE.test(hoverColor) ? hoverColor : fillColor
}

// Background color of a zone's own plot-number badge (its "label" drawn at
// its centre) — independent of fill/border/hover, same picker (palette +
// wheel) as those. null means the original neutral light pill; a valid hex
// switches the badge to that color with white text (badgeLabelStyleFor
// below), matching how border/hover both work.
export function normalizeLabelColor(v) {
    return typeof v === 'string' && HEX_RE.test(v) ? v : null
}

// Inline style attribute value for a zone-label badge — empty string keeps
// the default CSS (.zone-label's light pill), a chosen color overrides both
// background and text color so it stays legible on any preset.
export function badgeLabelStyleFor(labelColor) {
    return typeof labelColor === 'string' && HEX_RE.test(labelColor)
        ? `background:${labelColor};color:#fff`
        : ''
}

// null/invalid clears the override (falls back to the default) rather than
// rejecting the save — same "don't block the rest of the write" rule
// lib/hotspots.js's normalizeHotspotColor uses, just returning null instead
// of a forced default since an override is optional here.
export function normalizeCustomColor(v) {
    return typeof v === 'string' && HEX_RE.test(v) ? v : null
}

// A zone's fill opacity — independent of, and applies on top of, whichever
// color it ends up with (preset status or custom). 0.33 matches what every
// zone already looked like before this was configurable (the old hardcoded
// '55' hex-alpha suffix, 0x55/255 ≈ 0.33), so existing zones need no
// backfill and no visible change until someone actually adjusts the slider.
export const DEFAULT_FILL_OPACITY = 0.33

// Opacity while the pointer is over the zone — an ABSOLUTE value, not a bump
// added to fill_opacity the way the old hardcoded +0x44/255 boost was. The
// default is what that boost produced for a zone left at the default 0.33
// fill (0.33 + 0.27 = 0.6), so the common case is unchanged. See db/021's
// header for why absolute rather than relative.
export const DEFAULT_HOVER_OPACITY = 0.6

// Paint order for overlapping zones — lower draws first (underneath), so a
// road/common-area strip set to -1 sits beneath the plots crossing it.
// Bounded to a small range because this is a hand-set layering hint, not a
// coordinate: anything outside it is a typo or a hostile payload, and
// clamping keeps the sort total-ordered either way. A non-numeric value
// falls back to 0 (the default every existing row already has) rather than
// rejecting the whole write, same rule as normalizeFillOpacity below.
export const MAX_Z_INDEX = 99

export function normalizeZIndex(v) {
    const n = Number(v)
    if (!Number.isFinite(n)) return 0
    return Math.min(MAX_Z_INDEX, Math.max(-MAX_Z_INDEX, Math.round(n)))
}

export function normalizeFillOpacity(v) {
    const n = Number(v)
    if (!Number.isFinite(n)) return DEFAULT_FILL_OPACITY
    return Math.min(1, Math.max(0, Math.round(n * 100) / 100))
}

export function normalizeHoverOpacity(v) {
    const n = Number(v)
    if (!Number.isFinite(n)) return DEFAULT_HOVER_OPACITY
    return Math.min(1, Math.max(0, Math.round(n * 100) / 100))
}

// Two-hex-digit alpha suffix for a `#rrggbb` fill color, e.g. appended as
// `color + alphaHex(opacity)`. Shared by both the editor (middle.jsx) and
// the published-tour builder (export.jsx keeps its own hand-synced copy,
// same convention as FLOOR_SIZE_MULTIPLIER — it can't import this file,
// since its output ships as a plain string).
export function alphaHex(opacity) {
    const a = Math.round(Math.min(1, Math.max(0, opacity)) * 255)
    return a.toString(16).padStart(2, '0')
}

const STATUS_RE = /^[a-z0-9_-]{1,32}$/i

const num = (v, lo, hi) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return null
    return Math.min(hi, Math.max(lo, Math.round(n * 100) / 100))
}

// Yaw is circular (the +/-180 seam wraps back on itself), unlike pitch, which
// is a genuine bounded range (-90 = straight down, 90 = straight up). A yaw of
// -180.4 isn't out of range, it's just +179.6 the long way round — clamping it
// to -180 (what a plain min/max clamp does) silently teleports that vertex to
// a different point on the sphere. This is the exact bug that made zones near
// the yaw seam render as a twisted/collapsed shape while zones elsewhere were
// fine: this file was clamping yaw the same way it clamps pitch.
function wrapYaw(n) {
    return Math.round((((n + 180) % 360 + 360) % 360 - 180) * 100) / 100
}

// Array of [yaw, pitch] pairs (or {yaw,pitch} objects), degrees. A malformed
// vertex drops the WHOLE polygon (returns null) rather than mangling one bad
// point into range — silently distorting the shape is worse than rejecting
// the request outright.
export function normalizePoints(raw) {
    if (!Array.isArray(raw)) return null
    if (raw.length > MAX_POLYGON_VERTICES) return null

    const points = []
    for (const p of raw) {
        const yawRaw   = Array.isArray(p) ? p[0] : p?.yaw
        const pitchRaw = Array.isArray(p) ? p[1] : p?.pitch
        const yawN  = Number(yawRaw)
        const pitch = num(pitchRaw, -90, 90)
        if (!Number.isFinite(yawN) || pitch == null) return null
        points.push([wrapYaw(yawN), pitch])
    }

    return points.length >= MIN_POLYGON_VERTICES ? points : null
}

export function normalizeStatus(raw) {
    const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
    return STATUS_RE.test(s) ? s : 'available'
}

export function normalizeLabel(raw) {
    return typeof raw === 'string' ? raw.slice(0, MAX_LABEL_LEN) : ''
}

// Per-edge length labels ("plot dimensions") — free text the user types
// directly (e.g. "12 ft", "3.6m"), not a computed value: zones live in
// angular sphere coordinates with no inherent real-world scale, so there's
// nothing to calibrate against automatically. Edge i runs from points[i] to
// points[(i+1) % pointCount] — the array is always padded/truncated to
// exactly pointCount entries so it can never drift out of sync with the
// shape it describes (a zone that gained/lost a vertex some other way, or
// a row saved before this column existed, both still line up correctly).
export function normalizeEdgeLengths(raw, pointCount) {
    const arr = Array.isArray(raw) ? raw : []
    const out = []
    for (let i = 0; i < pointCount; i++) {
        const v = arr[i]
        out.push(typeof v === 'string' ? v.trim().slice(0, MAX_EDGE_LABEL_LEN) : '')
    }
    return out
}

// Free-form key/value detail card (price, size, whatever). Primitive values
// only — no nesting, no arrays — and capped on both key count and total
// serialized size so one polygon can't carry an unbounded payload.
export function normalizeDetail(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

    const entries = Object.entries(raw)
        .slice(0, MAX_DETAIL_KEYS)
        .filter(([k, v]) =>
            typeof k === 'string' && k.length > 0 && k.length <= 40 &&
            (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null)
        )

    const out = Object.fromEntries(entries)
    return JSON.stringify(out).length <= MAX_DETAIL_JSON_LEN ? out : {}
}

// Centre of the polygon, used to anchor its popup/detail-card. A plain
// arithmetic mean — fine for the compact, single-object-sized shapes this
// feature is for; doesn't attempt to handle a polygon spanning the +/-180 deg
// yaw seam.
export function centroidOf(points) {
    const n = points.length
    if (!n) return { yaw: 0, pitch: 0 }
    let sumYaw = 0, sumPitch = 0
    for (const [yaw, pitch] of points) { sumYaw += yaw; sumPitch += pitch }
    return { yaw: sumYaw / n, pitch: sumPitch / n }
}
