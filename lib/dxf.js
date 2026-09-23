// lib/dxf.js
//
// Parses a DXF (AutoCAD's open, text-based drawing format) into plain
// geometry — used to import a site/floor plan as a calibrated reference plan
// to trace zones over (see lib/reference-plan.js for what happens to the
// geometry next, and polygon_panel.jsx for the UI). Real .dwg files are a
// closed binary format with no viable free parser; DXF is what every CAD
// tool, AutoCAD included, can "Save As" instead.
//
// Client-side only in practice (dxf-parser is pure JS with no Node-specific
// APIs, so it bundles fine), though nothing here depends on the DOM.
//
// Coordinates come out as RAW DXF model space: Y-up, unscaled, unflipped.
// That is deliberate — flipping Y to match SVG's Y-down convention would be
// a REFLECTION, and the similarity fit in lib/reference-plan.js cannot
// represent one, so a correctly-drawn plan would become unfittable. Display
// code flips for presentation only; the stored data never does.

import DxfParser from 'dxf-parser'

// Segments used to flatten a curve. Matches the ARC branch's own resolution
// — at typical site-plan scale the facets are imperceptible, and every
// consumer wants uniform point arrays rather than a special curve case.
const CURVE_SEGMENTS = 32

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
            shapes.push({ tag: 'polygon', pts: arcPoints(e.center.x, e.center.y, e.radius, 0, 360) })
        } else if (e.type === 'ARC' && e.center && e.radius != null) {
            shapes.push({ tag: 'polyline', pts: arcPoints(e.center.x, e.center.y, e.radius, e.startAngle, e.endAngle) })
        }
    }

    return { shapes, bbox: { minX, minY, maxX, maxY } }
}

export function dxfTextToShapes(dxfText) {
    const dxf = new DxfParser().parseSync(dxfText)
    const { shapes, bbox } = collectShapes(dxf?.entities)

    if (!shapes.length || !Number.isFinite(bbox.minX)) {
        throw new Error('No supported entities (lines, polylines, circles, arcs) found in this DXF.')
    }
    return { shapes, bbox }
}
