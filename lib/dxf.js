// lib/dxf.js
//
// Parses a DXF (AutoCAD's open, text-based drawing format) into plain
// geometry — used by the 'siteplan' hotspot type (lib/arrows.js's
// planDecalImage) to render an imported site/floor plan as a real
// 3D-embedded imageLayer decal, the same mechanism as floor/text hotspots.
// Real .dwg files are a closed binary format with no viable free parser;
// DXF is what every CAD tool, AutoCAD included, can "Save As" instead.
//
// Client-side only in practice (dxf-parser is pure JS with no Node-specific
// APIs, so it bundles fine), though nothing here depends on the DOM.
//
// Coordinates come out as RAW DXF model space: Y-up, unscaled. Flipping to
// SVG's Y-down convention happens in planDecalImage at render time, not
// here — this stays a plain, presentation-agnostic parse.

import DxfParser from 'dxf-parser'

// Segments used to flatten a curve. Matches the ARC branch's own resolution
// — at typical site-plan scale the facets are imperceptible, and every
// consumer wants uniform point arrays rather than a special curve case.
const CURVE_SEGMENTS = 32

// Raw DXF floats carry ~15 significant digits (33931.17924475761); 3 decimal
// places is far below anything visible in the decal and roughly halves the
// stored/transmitted JSON.
const r3 = v => Math.round(v * 1000) / 1000

// Only the entity types a flat site plan is actually drawn with. Text,
// dimensions, hatches, splines and block INSERTs are silently skipped rather
// than attempted — a partial-but-correct plan traces fine, whereas throwing
// on the first unsupported entity would reject most real drawings.
function collectShapes(entities) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const bound = (x, y) => {
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
    }

    const arcPoints = (cx, cy, r, startDeg, endDeg) => {
        const startRad = (startDeg ?? 0) * Math.PI / 180
        const endRad   = (endDeg ?? 360) * Math.PI / 180
        let sweep = endRad - startRad
        if (sweep <= 0) sweep += Math.PI * 2
        const pts = []
        for (let i = 0; i <= CURVE_SEGMENTS; i++) {
            const t = startRad + sweep * (i / CURVE_SEGMENTS)
            const x = cx + r * Math.cos(t)
            const y = cy + r * Math.sin(t)
            bound(x, y); pts.push([x, y])
        }
        return pts
    }

    const shapes = []
    for (const e of entities || []) {
        if (e.type === 'LINE' && e.vertices?.length >= 2) {
            const [a, b] = e.vertices
            bound(a.x, a.y); bound(b.x, b.y)
            shapes.push({ tag: 'polyline', pts: [[a.x, a.y], [b.x, b.y]] })
        } else if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.vertices?.length >= 2) {
            const pts = e.vertices.map(v => { bound(v.x, v.y); return [v.x, v.y] })
            // dxf-parser exposes the closed-polyline flag as `shape`.
            shapes.push({ tag: e.shape ? 'polygon' : 'polyline', pts })
        } else if (e.type === 'CIRCLE' && e.center && e.radius) {
            // Flattened like an arc, minus the open ends — every consumer
            // wants point arrays, not a cx/cy/r special case.
            shapes.push({ tag: 'polygon', pts: arcPoints(e.center.x, e.center.y, e.radius, 0, 360), circle: true })
        } else if (e.type === 'ARC' && e.center && e.radius != null) {
            shapes.push({ tag: 'polyline', pts: arcPoints(e.center.x, e.center.y, e.radius, e.startAngle, e.endAngle) })
        }
    }

    // Thinning: drop points that lie within a hair of the straight line
    // through their neighbours (Douglas–Peucker at 0.005% of the drawing's
    // size — ~10x finer than one pixel of the 2048px decal, so invisible).
    // CAD exports are full of such points: a real 113k-point site plan came
    // down to ~61k this way, under the import limit. Circles keep every point — the plot-number
    // bubble detection in lib/plan-faces.js recognises them by it.
    const extent = Math.max(maxX - minX, maxY - minY) || 1
    const tol = extent * 5e-5
    // Rounding scaled to the drawing, not fixed decimals: 3 decimals is
    // plenty for an 800,000-unit plan but coarse for a 15-unit one.
    const step = Math.pow(10, Math.floor(Math.log10(extent * 1e-6)))
    const rnd = v => Math.round(v / step) * step
    const seen = new Set()
    const out = []
    for (const s of shapes) {
        const pts = (s.circle ? s.pts : thinPoints(s.pts, tol)).map(([x, y]) => [rnd(x), rnd(y)])
        const key = s.tag + JSON.stringify(pts)
        if (seen.has(key)) continue      // exact duplicate shape
        seen.add(key)
        out.push({ tag: s.tag, pts })
    }
    return { shapes: out, bbox: { minX: rnd(minX), minY: rnd(minY), maxX: rnd(maxX), maxY: rnd(maxY) } }
}

// Douglas–Peucker: keeps only the points that deviate more than `tol` from
// the line between the points kept on either side. First and last always
// stay, so a closed shape stays closed and every shape keeps its ends.
function thinPoints(pts, tol) {
    if (pts.length < 3) return pts
    const keep = new Uint8Array(pts.length)
    keep[0] = keep[pts.length - 1] = 1
    const stack = [[0, pts.length - 1]]
    while (stack.length) {
        const [a, c] = stack.pop()
        const [ax, ay] = pts[a], [cx, cy] = pts[c]
        const dx = cx - ax, dy = cy - ay, len = Math.hypot(dx, dy)
        let mi = -1, md = 0
        for (let i = a + 1; i < c; i++) {
            // Distance to the segment line (or to the point itself when the
            // two ends coincide, as on a closed shape's first/last pair).
            const d = len ? Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len : Math.hypot(pts[i][0] - ax, pts[i][1] - ay)
            if (d > md) { md = d; mi = i }
        }
        if (mi > 0 && md > tol) { keep[mi] = 1; stack.push([a, mi], [mi, c]) }
    }
    return pts.filter((_, i) => keep[i])
}

// Short text labels (TEXT/MTEXT) with their positions — on a site plan these
// are mostly plot numbers, which the editor uses to name plot zones. Long
// text (notes, title blocks) is skipped. Not part of the drawn decal.
const MAX_LABEL_CHARS = 12
function collectLabels(entities) {
    const labels = []
    for (const e of entities || []) {
        let text, p
        if (e.type === 'TEXT') {
            text = e.text
            // A justified TEXT's real anchor is its alignment point.
            p = (e.halign || e.valign) && e.endPoint ? e.endPoint : e.startPoint
        } else if (e.type === 'MTEXT') {
            // Strip MTEXT formatting codes: {\fArial|b0;42}, \P, \~ etc.
            text = String(e.text || '').replace(/\\[A-Za-z][^;\\{}]*;/g, '').replace(/\\P/g, ' ').replace(/\\~/g, ' ').replace(/[{}]/g, '')
            p = e.position
        } else continue
        text = String(text || '').trim()
        if (!text || text.length > MAX_LABEL_CHARS || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
        labels.push({ x: r3(p.x), y: r3(p.y), text, layer: String(e.layer || '').slice(0, 40) })
    }
    return labels
}

export function dxfTextToLabels(dxfText) {
    return collectLabels(new DxfParser().parseSync(dxfText)?.entities)
}

export function dxfTextToShapes(dxfText) {
    const dxf = new DxfParser().parseSync(dxfText)
    const { shapes, bbox } = collectShapes(dxf?.entities)

    if (!shapes.length || !Number.isFinite(bbox.minX)) {
        throw new Error('No supported entities (lines, polylines, circles, arcs) found in this DXF.')
    }
    return { shapes, bbox, labels: collectLabels(dxf.entities) }
}
