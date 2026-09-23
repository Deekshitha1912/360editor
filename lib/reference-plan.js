// lib/reference-plan.js
//
// The geometry behind the DXF reference plan — an imported site/floor plan
// calibrated against a scene's photo and drawn on the ground as a tracing
// guide for zones. See db/015_add_scene_reference_plan.sql for the stored
// shape, and polygon_panel.jsx for the calibration UI.
//
// ── The model ────────────────────────────────────────────────────────────
// A site plan IS the ground plane, so no computer vision is needed to place
// one on a panorama — only the correspondence between a few plan points and
// the same points in the photo, which the user supplies by clicking pairs.
//
// Camera sits at the origin, ground is a flat plane exactly 1 unit below it.
// Everything is therefore in camera-height units and the real height never
// has to be known — it folds into the scale factor fitSimilarity solves for.
//
// Two assumptions bound the accuracy, and both hold well for the drone/site
// imagery this is built for: the panorama is level, and the ground is flat.
// A tilted horizon shows up as a plan that fits near the calibration points
// and drifts away from them — more pairs will NOT fix that, because the
// model itself is wrong.
//
// Pure functions only — imported by the editor AND by the scenes PATCH route
// (for normalizeReferencePlan), so nothing here may touch the DOM.

const RAD = Math.PI / 180
const DEG = 180 / Math.PI

// Storage caps, to bound the jsonb row size.
export const MAX_PLAN_SHAPES = 200
export const MAX_PLAN_POINTS = 2000
export const MAX_PLAN_PAIRS  = 12

// A ground point's pitch approaches 0 as it recedes toward infinity, so
// everything flatter than this is clipped rather than rendered — at -3deg a
// point already sits ~19 camera-heights out, and past that the projection
// smears along the horizon line. Segments are SPLIT at the clip rather than
// joined across it (see projectPointList).
export const MIN_ABS_PITCH_DEG = 3

// Rendering budget for one projected plan, after subdivision.
const MAX_RENDER_POINTS = 4000
// Max angular gap between consecutive rendered points. PSV joins polyline
// vertices with straight SCREEN-SPACE chords — __getPolyPositions in
// markers-plugin only inserts extra points for behind-camera clipping, never
// for curvature — and a straight line on the ground is a curve in the
// panorama. Without subdivision every long edge visibly cuts the corner.
const MAX_STEP_DEG = 2
const MAX_SUBDIV_DEPTH = 6

// ── sphere <-> ground ────────────────────────────────────────────────────

// (yaw, pitch) in degrees -> ground point [X, Y].
// null above the horizon clip: those directions never meet the ground.
export function sphereToGround(yawDeg, pitchDeg) {
    if (!(pitchDeg < -MIN_ABS_PITCH_DEG)) return null
    const r = 1 / Math.tan(-pitchDeg * RAD)
    return [r * Math.sin(yawDeg * RAD), r * Math.cos(yawDeg * RAD)]
}

// ground point [X, Y] -> { yaw, pitch } in degrees, or null once it reaches
// the horizon clip. r = 0 (directly under the camera) gives pitch -90, the
// nadir — matching COVERUP_DEFAULTS' own "-90 = straight down" convention.
export function groundToSphere(X, Y) {
    const pitch = -Math.atan2(1, Math.hypot(X, Y)) * DEG
    if (pitch > -MIN_ABS_PITCH_DEG) return null
    return { yaw: Math.atan2(X, Y) * DEG, pitch }
}

// ── plan -> ground ───────────────────────────────────────────────────────
// A 2D similarity: scale, rotation, translation. Deliberately NOT a full
// affine or homography — the plan and the ground are the same rigid shape at
// a different scale, so anything with more freedom would just fit noise in
// the clicked pairs and shear the drawing.
//
// Note a similarity cannot represent a REFLECTION, which is why `mirror` is
// a separate explicit flag rather than something the fit could discover. Raw
// DXF coordinates are kept Y-up throughout for the same reason: flipping Y
// to match SVG's Y-down convention would be a reflection, and would make a
// correctly-drawn plan unfittable.

function mirrorPoint([u, v], mirror) {
    return mirror ? [-u, v] : [u, v]
}

// Closed-form least-squares similarity (Umeyama). Two pairs determine it
// exactly; three or more are fitted, leaving a residual worth showing.
function fitSimilarity(prepared) {
    const n = prepared.length
    if (n < 2) return null

    let pcx = 0, pcy = 0, gcx = 0, gcy = 0
    for (const { plan, ground } of prepared) {
        pcx += plan[0];   pcy += plan[1]
        gcx += ground[0]; gcy += ground[1]
    }
    pcx /= n; pcy /= n; gcx /= n; gcy /= n

    let dot = 0, cross = 0, norm = 0
    for (const { plan, ground } of prepared) {
        const ax = plan[0] - pcx,   ay = plan[1] - pcy
        const bx = ground[0] - gcx, by = ground[1] - gcy
        dot   += ax * bx + ay * by
        cross += ax * by - ay * bx
        norm  += ax * ax + ay * ay
    }
    // Every plan point identical — no scale or angle is recoverable.
    if (!(norm > 0)) return null

    const theta = Math.atan2(cross, dot)
    const scale = Math.hypot(dot, cross) / norm
    if (!Number.isFinite(scale) || scale <= 0) return null

    const cos = Math.cos(theta), sin = Math.sin(theta)
    return {
        scale, cos, sin,
        tx: gcx - scale * (cos * pcx - sin * pcy),
        ty: gcy - scale * (sin * pcx + cos * pcy),
    }
}

// pairs: [{ plan: [u,v], yaw, pitch }] as stored. Returns a transform (with
// the mirror folded in, so planToGround needs no second argument) or null
// when fewer than two usable pairs survive.
export function buildTransform(pairs, mirror = false) {
    const prepared = []
    for (const p of pairs || []) {
        if (!Array.isArray(p?.plan)) continue
        const ground = sphereToGround(p.yaw, p.pitch)
        // A pair clicked at or above the horizon can't be turned into a
        // ground point at all, so it simply doesn't constrain the fit.
        if (!ground) continue
        prepared.push({ plan: mirrorPoint(p.plan, mirror), ground })
    }
    if (prepared.length < 2) return null
    const t = fitSimilarity(prepared)
    return t ? { ...t, mirror: !!mirror } : null
}

export function planToGround(pt, t) {
    const [x, y] = mirrorPoint(pt, t.mirror)
    return [
        t.scale * (t.cos * x - t.sin * y) + t.tx,
        t.scale * (t.sin * x + t.cos * y) + t.ty,
    ]
}

// Mean angular error between where each calibration pair was clicked in the
// photo and where the fitted transform actually puts that plan point. Always
// ~0 for exactly two pairs (they're solved exactly), so the readout only
// means anything from three pairs up.
export function residualDegrees(pairs, t) {
    if (!t) return null
    let sum = 0, n = 0
    for (const p of pairs || []) {
        if (!Array.isArray(p?.plan)) continue
        const g = planToGround(p.plan, t)
        const s = groundToSphere(g[0], g[1])
        if (!s) continue
        sum += angularGap(s, { yaw: p.yaw, pitch: p.pitch })
        n += 1
    }
    return n ? sum / n : null
}

// ── projection ───────────────────────────────────────────────────────────

function angularGap(a, b) {
    const ap = a.pitch * RAD, bp = b.pitch * RAD
    const dot = Math.sin(ap) * Math.sin(bp)
        + Math.cos(ap) * Math.cos(bp) * Math.cos((a.yaw - b.yaw) * RAD)
    return Math.acos(Math.min(1, Math.max(-1, dot))) * DEG
}

// Emits the points strictly BETWEEN g0 and g1, splitting at the ground-space
// midpoint (not the angular midpoint — the straight ground line is what we
// want to follow) until each step is under MAX_STEP_DEG.
function subdivide(g0, s0, g1, s1, depth, out) {
    if (depth >= MAX_SUBDIV_DEPTH || angularGap(s0, s1) <= MAX_STEP_DEG) return
    const gm = [(g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2]
    const sm = groundToSphere(gm[0], gm[1])
    if (!sm) return
    subdivide(g0, s0, gm, sm, depth + 1, out)
    out.push(sm)
    subdivide(gm, sm, g1, s1, depth + 1, out)
}

// One shape can yield SEVERAL runs: wherever a point clips at the horizon the
// run is broken rather than drawn across the gap. `toGround` is the one
// difference between projecting a PLAN (still needs the calibration
// transform applied per point) and projecting shapes that are ALREADY in
// ground space (ground text's baked glyph outlines — see lib/ground-text.js)
// — everything past that point (subdivision, horizon clipping, the run
// budget) is identical, so it lives here once.
function projectPointList(pts, toGround, closed) {
    const seq = closed && pts.length > 2 ? [...pts, pts[0]] : pts
    const runs = []
    let run = [], prevG = null, prevS = null

    for (const pt of seq) {
        const g = toGround(pt)
        const s = groundToSphere(g[0], g[1])
        if (!s) {
            if (run.length > 1) runs.push(run)
            run = []; prevG = null; prevS = null
            continue
        }
        if (prevS) subdivide(prevG, prevS, g, s, 0, run)
        run.push(s)
        prevG = g; prevS = s
    }
    if (run.length > 1) runs.push(run)
    return runs
}

// shapes (ALREADY in ground-space [X,Y] points, e.g. ground text's baked
// glyph outlines) -> arrays of [[yawDeg, pitchDeg], ...], each ready to hand
// straight to a PSV polyline marker. Shared budget across every shape passed
// in one call, so a caller rendering several labels can cap the total cost
// by calling this once with all of them concatenated.
export function projectGroundShapes(shapes, budget = MAX_RENDER_POINTS) {
    const out = []
    for (const shape of shapes || []) {
        const pts = shape?.pts
        if (!Array.isArray(pts) || pts.length < 2) continue
        for (const run of projectPointList(pts, pt => pt, shape.tag === 'polygon')) {
            const trimmed = budget >= run.length ? run : run.slice(0, budget)
            budget -= trimmed.length
            if (trimmed.length > 1) out.push(trimmed.map(s => [s.yaw, s.pitch]))
            if (budget <= 0) return out
        }
    }
    return out
}

// shapes in PLAN space (raw DXF coordinates) + a calibration transform ->
// same output shape as projectGroundShapes. The reference plan's own
// rendering path — everything else routes through projectGroundShapes
// directly, already baked.
export function projectPlan(shapes, t) {
    if (!t) return []
    const out = []
    let budget = MAX_RENDER_POINTS

    for (const shape of shapes || []) {
        const pts = shape?.pts
        if (!Array.isArray(pts) || pts.length < 2) continue
        for (const run of projectPointList(pts, pt => planToGround(pt, t), shape.tag === 'polygon')) {
            const trimmed = budget >= run.length ? run : run.slice(0, budget)
            budget -= trimmed.length
            if (trimmed.length > 1) out.push(trimmed.map(s => [s.yaw, s.pitch]))
            if (budget <= 0) return out
        }
    }
    return out
}

// Every distinct plan vertex, projected — the snap candidates offered while
// drawing a zone, so tracing actually locks onto the plan's corners.
export function planVertices(shapes, t) {
    if (!t) return []
    const out = []
    for (const shape of shapes || []) {
        for (const pt of shape?.pts || []) {
            const g = planToGround(pt, t)
            const s = groundToSphere(g[0], g[1])
            if (s) out.push([s.yaw, s.pitch])
            if (out.length >= MAX_PLAN_POINTS) return out
        }
    }
    return out
}

// ── storage sanitation ───────────────────────────────────────────────────
// Never trust the client's shape — PATCH /api/scenes/[id] runs every write
// through this, the same way overlays go through lib/overlays.js.

const finite = v => typeof v === 'number' && Number.isFinite(v)
const clampDeg = (v, lo, hi) => (finite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 100) / 100)) : null)

function normalizePoint(raw) {
    if (!Array.isArray(raw) || raw.length < 2) return null
    const [x, y] = raw
    if (!finite(x) || !finite(y)) return null
    return [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]
}

// null means "not a valid plan" — the caller treats that as a clear, not a
// silent no-op, so deleting is just PATCHing reference_plan: null.
export function normalizeReferencePlan(raw) {
    if (raw === null || raw === undefined) return null
    if (typeof raw !== 'object' || Array.isArray(raw)) return null

    const shapes = []
    let points = 0
    for (const s of Array.isArray(raw.shapes) ? raw.shapes.slice(0, MAX_PLAN_SHAPES) : []) {
        const pts = []
        for (const p of Array.isArray(s?.pts) ? s.pts : []) {
            const pt = normalizePoint(p)
            if (!pt) continue
            pts.push(pt)
            if (++points >= MAX_PLAN_POINTS) break
        }
        if (pts.length >= 2) shapes.push({ tag: s.tag === 'polygon' ? 'polygon' : 'polyline', pts })
        if (points >= MAX_PLAN_POINTS) break
    }
    if (!shapes.length) return null

    const pairs = []
    for (const p of Array.isArray(raw.pairs) ? raw.pairs.slice(0, MAX_PLAN_PAIRS) : []) {
        const plan = normalizePoint(p?.plan)
        const yaw = clampDeg(p?.yaw, -180, 180)
        const pitch = clampDeg(p?.pitch, -90, 90)
        if (!plan || yaw === null || pitch === null) continue
        pairs.push({ plan, yaw, pitch })
    }

    const b = raw.bbox || {}
    const bbox = [b.minX, b.minY, b.maxX, b.maxY].every(finite)
        ? { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY }
        : boundsOf(shapes)

    return {
        name: typeof raw.name === 'string' ? raw.name.slice(0, 120) : '',
        shapes,
        bbox,
        pairs,
        mirror: !!raw.mirror,
        visible: raw.visible !== false,
    }
}

export function boundsOf(shapes) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const s of shapes || []) {
        for (const [x, y] of s?.pts || []) {
            if (x < minX) minX = x; if (x > maxX) maxX = x
            if (y < minY) minY = y; if (y > maxY) maxY = y
        }
    }
    return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : { minX: 0, minY: 0, maxX: 1, maxY: 1 }
}
