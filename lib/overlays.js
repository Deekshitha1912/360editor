// lib/overlays.js
//
// One place that decides what a valid overlay is. Imported by the API routes
// (to sanitise what gets stored), by the export builder (to render), and by the
// editor (to create new ones). Never trust the client's shape — every write
// goes through normalizeLogos / normalizeCoverups.
//
// Both kinds carry an optional scene_id:
//     scene_id === null  → shown in EVERY scene
//     scene_id === <id>  → shown only in that scene
//
// LOGO       screen-anchored. { id, url, scene_id, x, y, size, opacity }
//            x / y  — percent of the viewport, 0–100, marking the CENTRE
//            size   — rendered width in px
//
// COVER-UP   sphere-anchored. { id, url, scene_id, pitch, yaw, size, opacity, rotation }
//            An every-scene cover-up hides the tripod (same nadir in every
//            panorama); a scene-scoped one hides something in one room.
//            pitch  — −90 … 90, defaults to −90: straight down, the nadir
//            yaw    — −180 … 180
//            size   — width in px at the scene's opening field of view; the
//                     viewer scales it with zoom so it keeps covering what it
//                     was placed over
//            rotation — degrees, for lining the patch up with a surface

export const MAX_LOGOS    = 10
export const MAX_COVERUPS = 20

export const LOGO_DEFAULTS    = { scene_id: null, x: 50, y: 50, size: 160, opacity: 0.9 }
// Nadir by default — the tripod is directly below the camera.
export const COVERUP_DEFAULTS = { scene_id: null, pitch: -90, yaw: 0, size: 220, opacity: 1, rotation: 0 }

const num = (v, lo, hi, fallback) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return fallback
    return Math.min(hi, Math.max(lo, Math.round(n * 100) / 100))
}

export function newOverlayId(prefix = 'ov') {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

// Storage URLs only. Stops a crafted payload from turning a tour into a
// hotlink to somewhere else, or from embedding a javascript: URL.
// null (every scene) or a plausible scene id. Not a strict UUID check — the id
// only has to match a scene the project owns, which the caller guarantees.
function cleanSceneId(v) {
    if (v === null || v === undefined || v === '') return null
    return typeof v === 'string' && v.length <= 40 ? v : null
}

export function isSafeImageUrl(url) {
    return typeof url === 'string'
        && url.length > 0
        && url.length <= 600
        && /^https:\/\//i.test(url)
}

export function normalizeLogo(raw) {
    if (!raw || !isSafeImageUrl(raw.url)) return null
    return {
        id:       typeof raw.id === 'string' && raw.id.length <= 40 ? raw.id : newOverlayId('lg'),
        url:      raw.url,
        scene_id: cleanSceneId(raw.scene_id),
        x:       num(raw.x,       0,   100,  LOGO_DEFAULTS.x),
        y:       num(raw.y,       0,   100,  LOGO_DEFAULTS.y),
        size:    num(raw.size,    16,  1600, LOGO_DEFAULTS.size),
        opacity: num(raw.opacity, 0.05, 1,   LOGO_DEFAULTS.opacity),
    }
}

export function normalizeCoverup(raw) {
    if (!raw || !isSafeImageUrl(raw.url)) return null
    return {
        id:       typeof raw.id === 'string' && raw.id.length <= 40 ? raw.id : newOverlayId('cv'),
        url:      raw.url,
        scene_id: cleanSceneId(raw.scene_id),
        pitch:    num(raw.pitch,    -90,  90,   COVERUP_DEFAULTS.pitch),
        yaw:      num(raw.yaw,      -180, 180,  COVERUP_DEFAULTS.yaw),
        size:     num(raw.size,     16,   2000, COVERUP_DEFAULTS.size),
        opacity:  num(raw.opacity,  0.05, 1,    COVERUP_DEFAULTS.opacity),
        rotation: num(raw.rotation, -180, 180,  COVERUP_DEFAULTS.rotation),
    }
}

function normalizeList(value, fn, max) {
    if (!Array.isArray(value)) return null          // null = "not a valid update"
    const seen = new Set()
    const out  = []
    for (const raw of value.slice(0, max)) {
        const item = fn(raw)
        if (!item) continue
        if (seen.has(item.id)) item.id = newOverlayId('ov')   // ids must be unique
        seen.add(item.id)
        out.push(item)
    }
    return out
}

export const normalizeLogos    = v => normalizeList(v, normalizeLogo,    MAX_LOGOS)
export const normalizeCoverups = v => normalizeList(v, normalizeCoverup, MAX_COVERUPS)

// ─── Reading, with the legacy single-logo shape as a fallback ────────────────
// Projects migrated before overlays existed still carry logo_url/logo_x/… , and
// so do published snapshots taken back then. Everything that renders a project
// goes through this, so both shapes work and no tour breaks mid-migration.
export function projectLogos(project) {
    if (!project) return []

    const stored = normalizeLogos(project.overlays)
    if (stored?.length) return stored

    if (isSafeImageUrl(project.logo_url)) {
        const legacy = normalizeLogo({
            id:      'lg_legacy',
            url:     project.logo_url,
            x:       project.logo_x,
            y:       project.logo_y,
            size:    project.logo_size,
            opacity: LOGO_DEFAULTS.opacity,
        })
        return legacy ? [legacy] : []
    }
    return []
}

export function projectCoverups(project) {
    return normalizeCoverups(project?.coverups) ?? []
}

// The subset shown in a given scene: every-scene entries (scene_id null) plus
// any scoped to this scene. Used by both the editor and the export builder.
export function overlaysForScene(list, sceneId) {
    return (list ?? []).filter(o => o.scene_id == null || o.scene_id === sceneId)
}