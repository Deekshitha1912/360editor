// lib/plan-faces.js
//
// Finds the enclosed regions ("faces") of a site plan's line drawing — each
// plot, and the site's overall outline — from lib/dxf.js's shapes. CAD site
// plans are mostly loose LINEs with plot dividers ending partway along the
// boundary (T-junctions), so no single closed shape exists to pick. Instead:
//   1. every segment is split wherever another one touches or crosses it,
//   2. endpoints are merged into a planar graph, dead ends pruned,
//   3. faces are traced by always turning to the next edge around a vertex.
// Pure functions in DXF units; used by the editor's zone-from-plan tools.

function signedArea(pts) {
    let s = 0
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length]
        s += p[0] * q[1] - q[0] * p[1]
    }
    return s / 2
}

// A closed shape of many points all (nearly) the same distance from their
// centre — what lib/dxf.js makes of a CIRCLE.
function isCircle(s) {
    if (s.tag !== 'polygon' || s.pts.length < 16) return false
    // lib/dxf.js repeats the first point at the end; counted twice it would
    // pull the centre off and make a true circle look uneven.
    const f = s.pts[0], l = s.pts[s.pts.length - 1]
    const pts = f[0] === l[0] && f[1] === l[1] ? s.pts.slice(0, -1) : s.pts
    const n = pts.length
    const cx = pts.reduce((t, p) => t + p[0], 0) / n, cy = pts.reduce((t, p) => t + p[1], 0) / n
    const r = pts.map(p => Math.hypot(p[0] - cx, p[1] - cy))
    const mean = r.reduce((t, v) => t + v, 0) / n
    return mean > 0 && r.every(v => Math.abs(v - mean) <= mean * 0.03)
}

// The DXF labels that are plot numbers: short numbers with an optional
// letter ("36", "36A"). When some sit on a layer named like "plot" (e.g.
// PLOTNO), only that layer is used, so stray dimension or note numbers on
// other layers don't get mistaken for plots.
export function plotNumberLabels(labels) {
    const nums = (labels || []).filter(l => /^\d{1,4}[A-Za-z]?$/.test(l.text))
    const onPlotLayer = nums.filter(l => /plot/i.test(l.layer || ''))
    return onPlotLayer.length ? onPlotLayer : nums
}

// Matches plot numbers to traced regions: each number goes to the smallest
// region containing it. Returns { plots: [{ label, pts }], unplaced, shared }
// — regions holding exactly one number become plots; numbers outside every
// region (unplaced) or sharing a region with another number (shared) are
// reported rather than guessed.
export function matchPlotsToFaces(faces, labels) {
    const byFace = new Map()
    let unplaced = 0
    for (const l of plotNumberLabels(labels)) {
        const f = faces.find(face => pointInPolygon(l.x, l.y, face.pts))
        if (!f) { unplaced++; continue }
        if (!byFace.has(f)) byFace.set(f, [])
        byFace.get(f).push(l.text)
    }
    const plots = [], seen = new Set()
    let shared = 0
    for (const [f, texts] of byFace) {
        const unique = [...new Set(texts)]
        if (unique.length !== 1) { shared += unique.length; continue }
        if (seen.has(unique[0])) continue      // same number drawn twice: keep the first
        seen.add(unique[0])
        plots.push({ label: unique[0], pts: f.pts })
    }
    const key = t => { const m = t.match(/^(\d+)(.*)$/); return m ? [Number(m[1]), m[2]] : [Infinity, t] }
    plots.sort((a, b) => { const [an, as] = key(a.label), [bn, bs] = key(b.label); return an - bn || as.localeCompare(bs) })
    return { plots, unplaced, shared }
}

export function buildPlanFaces(planShapes) {
    const b = planShapes.originalBbox || planShapes.bbox
    const extent = Math.max(b.maxX - b.minX, b.maxY - b.minY) || 1
    const tol = extent * 1e-6
    // How far a line end may reach to meet a line it stops just short of —
    // CAD drawings leave tiny gaps there (up to ~0.015% of the drawing on a
    // real site plan), which would otherwise leave the divider a dead end and
    // merge the two plots either side of it. Real separations are ~100x this.
    const reach = extent * 3e-4

    // Segments from every shape (polygons also close back to their start).
    // Circles are left out: on a site plan they're the bubbles drawn round
    // plot numbers, and each would otherwise be the smallest region around
    // its number — picked instead of the plot it sits in.
    const segs = []
    for (const s of planShapes.shapes || []) {
        if (isCircle(s)) continue
        const p = s.pts
        for (let i = 0; i + 1 < p.length; i++) segs.push([p[i], p[i + 1]])
        if (s.tag === 'polygon' && p.length > 2) segs.push([p[p.length - 1], p[0]])
    }

    // Split points per segment, as parameters t along it. A spatial grid
    // keeps the pairwise touch/cross test near-linear on big drawings.
    const cuts = segs.map(() => [0, 1])
    const cell = extent / Math.max(16, Math.ceil(Math.sqrt(segs.length) * 2))
    const grid = new Map()
    const cellsOf = ([a, c]) => {
        const out = []
        const x0 = Math.floor((Math.min(a[0], c[0]) - reach) / cell), x1 = Math.floor((Math.max(a[0], c[0]) + reach) / cell)
        const y0 = Math.floor((Math.min(a[1], c[1]) - reach) / cell), y1 = Math.floor((Math.max(a[1], c[1]) + reach) / cell)
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push(x + ',' + y)
        return out
    }
    segs.forEach((sg, i) => { for (const k of cellsOf(sg)) { let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(i) } })
    const seen = new Set()
    for (const list of grid.values()) {
        for (let m = 0; m < list.length; m++) for (let n = m + 1; n < list.length; n++) {
            const i = Math.min(list[m], list[n]), j = Math.max(list[m], list[n])
            const key = i * segs.length + j
            if (seen.has(key)) continue
            seen.add(key)
            const [p, p2] = segs[i], [q, q2] = segs[j]
            const r = [p2[0] - p[0], p2[1] - p[1]], s = [q2[0] - q[0], q2[1] - q[1]]
            const den = r[0] * s[1] - r[1] * s[0]
            const lr = Math.hypot(r[0], r[1]) || 1, ls = Math.hypot(s[0], s[1]) || 1
            if (Math.abs(den) < 1e-12 * lr * ls) {
                // Parallel: only collinear overlaps matter — cut each at the
                // other's endpoints where they lie on it.
                const on = (a, a2, pt, la) => {
                    const t = ((pt[0] - a[0]) * (a2[0] - a[0]) + (pt[1] - a[1]) * (a2[1] - a[1])) / (la * la)
                    const dx = a[0] + t * (a2[0] - a[0]) - pt[0], dy = a[1] + t * (a2[1] - a[1]) - pt[1]
                    return t > 0 && t < 1 && Math.hypot(dx, dy) <= tol ? t : null
                }
                for (const [pt, into, a, a2, la] of [[q, i, p, p2, lr], [q2, i, p, p2, lr], [p, j, q, q2, ls], [p2, j, q, q2, ls]]) {
                    const t = on(a, a2, pt, la); if (t != null) cuts[into].push(t)
                }
                continue
            }
            const qp = [q[0] - p[0], q[1] - p[1]]
            const t = (qp[0] * s[1] - qp[1] * s[0]) / den
            const u = (qp[0] * r[1] - qp[1] * r[0]) / den
            const et = reach / lr, eu = reach / ls
            if (t >= -et && t <= 1 + et && u >= -eu && u <= 1 + eu) {
                // Unclamped: a line that stops just short is extended to the
                // meeting point, so both end up sharing one node there.
                cuts[i].push(t)
                cuts[j].push(u)
            }
        }
    }

    // Merge nearby points into shared nodes (checking neighbouring cells so
    // a point just across a cell edge still merges).
    const nodes = [], nodeGrid = new Map()
    const nodeAt = (x, y) => {
        const cx = Math.floor(x / tol), cy = Math.floor(y / tol)
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            const l = nodeGrid.get((cx + dx) + ',' + (cy + dy))
            if (l) for (const id of l) if (Math.abs(nodes[id][0] - x) <= tol && Math.abs(nodes[id][1] - y) <= tol) return id
        }
        const id = nodes.length
        nodes.push([x, y])
        const k = cx + ',' + cy
        const l = nodeGrid.get(k); if (l) l.push(id); else nodeGrid.set(k, [id])
        return id
    }

    const adj = new Map()
    const link = (a, c) => {
        if (a === c) return
        if (!adj.has(a)) adj.set(a, new Set())
        if (!adj.has(c)) adj.set(c, new Set())
        adj.get(a).add(c); adj.get(c).add(a)
    }
    segs.forEach(([p, p2], i) => {
        const ts = [...new Set(cuts[i])].sort((a, c) => a - c)
        let prev = null
        for (const t of ts) {
            const id = nodeAt(p[0] + t * (p2[0] - p[0]), p[1] + t * (p2[1] - p[1]))
            if (prev != null) link(prev, id)
            prev = id
        }
    })

    // Dead ends bound nothing; peel them off.
    const stack = [...adj.keys()].filter(k => adj.get(k).size < 2)
    while (stack.length) {
        const v = stack.pop()
        const nb = adj.get(v)
        if (!nb) continue
        adj.delete(v)
        for (const w of nb) {
            const s = adj.get(w)
            if (!s) continue
            s.delete(v)
            if (s.size < 2) stack.push(w)
        }
    }

    // Neighbours sorted counter-clockwise by angle; from each directed edge
    // u→v, continue along the edge just clockwise of v→u. Every cycle found
    // is one face; bounded faces come out counter-clockwise (area > 0), the
    // outer boundary of each connected piece clockwise (area < 0).
    const order = new Map()
    for (const [v, nb] of adj) {
        order.set(v, [...nb].sort((a, c) =>
            Math.atan2(nodes[a][1] - nodes[v][1], nodes[a][0] - nodes[v][0]) -
            Math.atan2(nodes[c][1] - nodes[v][1], nodes[c][0] - nodes[v][0])))
    }
    const visited = new Set()
    const faces = [], outers = []
    for (const [u, nb] of order) {
        for (const v0 of nb) {
            if (visited.has(u + '>' + v0)) continue
            const cyc = []
            let a = u, c = v0, guard = 0
            while (!visited.has(a + '>' + c) && guard++ < 1e6) {
                visited.add(a + '>' + c)
                cyc.push(nodes[a])
                const list = order.get(c)
                const k = list.indexOf(a)
                const next = list[(k - 1 + list.length) % list.length]
                a = c; c = next
            }
            if (cyc.length < 3) continue
            const area = signedArea(cyc)
            if (area > 0) faces.push({ pts: cyc, area })
            else if (area < 0) outers.push({ pts: cyc, area: -area })
        }
    }
    faces.sort((a, c) => a.area - c.area)
    outers.sort((a, c) => c.area - a.area)
    // `outers`: the outline of every separate piece of the drawing, largest
    // first — used to spot a drawing that's in the file twice.
    return { faces, outline: outers[0]?.pts || null, outers }
}

// Cached per shapes array, so a big drawing is traced once however many
// times the editor asks.
const _facesCache = new WeakMap()
export function planFacesCached(planShapes) {
    let r = _facesCache.get(planShapes.shapes)
    if (!r) { r = buildPlanFaces(planShapes); _facesCache.set(planShapes.shapes, r) }
    return r
}

const boxOf = pts => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
    return { minX, minY, maxX, maxY }
}
const inBox = (b, x, y) => x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY

// The plot numbers that apply to the plan's visible (possibly cropped)
// area. Normally just those inside it. But a DXF sometimes holds the same
// layout twice — one copy numbered, one not — and the plan may be cropped to
// the unnumbered copy. Then the numbers are carried across: find the
// outline in view and another outline of the same size and area (the
// duplicate), and shift the duplicate's numbers by the exact offset between
// the two. Only accepted when most shifted numbers land inside a traced
// region, so an unrelated second drawing is never used.
export function visiblePlotNumbers(planShapes) {
    const view = planShapes.bbox
    const direct = plotNumberLabels((planShapes.labels || []).filter(l => inBox(view, l.x, l.y)))
    if (direct.length) return { labels: direct, borrowed: false }
    const all = plotNumberLabels(planShapes.labels)
    if (!all.length) return { labels: [], borrowed: false }

    const { faces, outers } = planFacesCached(planShapes)
    const pieces = outers.map(o => ({ area: o.area, box: boxOf(o.pts) }))
    const centreIn = (p, b) => inBox(b, (p.box.minX + p.box.maxX) / 2, (p.box.minY + p.box.maxY) / 2)
    const near = (a, b) => Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 0.01
    const shown = pieces.find(p => centreIn(p, view))
    if (!shown) return { labels: [], borrowed: false }
    const w = shown.box.maxX - shown.box.minX, h = shown.box.maxY - shown.box.minY
    for (const other of pieces) {
        if (other === shown || !near(other.area, shown.area)) continue
        if (!near(other.box.maxX - other.box.minX, w) || !near(other.box.maxY - other.box.minY, h)) continue
        const mine = all.filter(l => inBox(other.box, l.x, l.y))
        if (!mine.length) continue
        const dx = shown.box.minX - other.box.minX, dy = shown.box.minY - other.box.minY
        const moved = mine.map(l => ({ ...l, x: l.x + dx, y: l.y + dy })).filter(l => inBox(view, l.x, l.y))
        const landed = moved.filter(l => faces.some(f => pointInPolygon(l.x, l.y, f.pts))).length
        if (moved.length && landed >= moved.length * 0.8) return { labels: moved, borrowed: true }
    }
    return { labels: [], borrowed: false }
}

function pointInPolygon(x, y, pts) {
    let inside = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j]
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside
    }
    return inside
}

// The smallest enclosed region containing (x, y), in DXF units — the plot
// that was clicked. `faces` is buildPlanFaces(...).faces (sorted smallest
// first), so the first hit is the innermost.
export function planFaceAt(faces, x, y) {
    return faces.find(f => pointInPolygon(x, y, f.pts))?.pts || null
}

// Visvalingam–Whyatt: repeatedly drops the point whose triangle with its two
// neighbours has the smallest area until at most `max` remain. Real corners
// make big triangles and survive; near-collinear runs go first.
export function simplifyOutline(pts, max) {
    const out = pts.slice()
    const tri = i => {
        const a = out[(i - 1 + out.length) % out.length], b = out[i], c = out[(i + 1) % out.length]
        return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2
    }
    while (out.length > max) {
        let mi = 0, ma = Infinity
        for (let i = 0; i < out.length; i++) { const t = tri(i); if (t < ma) { ma = t; mi = i } }
        out.splice(mi, 1)
    }
    return out
}
