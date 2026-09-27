'use client'
// components/360editor/project/plan_crop_modal.jsx
//
// Crops a 'siteplan' hotspot's DXF drawing to a rectangle. The crop is just
// a smaller plan_shapes.bbox: planDecalImage fits bbox to the image, so any
// geometry outside it falls off the edge of the SVG and isn't drawn. The
// full imported extent stays in plan_shapes.originalBbox, so a crop can
// always be widened again or reset.

import { useEffect, useRef, useState } from 'react'
import { planDecalImage, planDecalSize } from '@/lib/arrows'

const MIN_FRAC = 0.02
const clamp01 = v => Math.min(1, Math.max(0, v))

// Crop rect as fractions of the full plan image: l/r from the left edge,
// t/b from the top. The image is Y-flipped (top = maxY), hence t/b use maxY.
function bboxToRect(bbox, o) {
    const W = o.maxX - o.minX, H = o.maxY - o.minY
    return {
        l: clamp01((bbox.minX - o.minX) / W),
        r: clamp01((bbox.maxX - o.minX) / W),
        t: clamp01((o.maxY - bbox.maxY) / H),
        b: clamp01((o.maxY - bbox.minY) / H),
    }
}

function rectToBbox(r, o) {
    const W = o.maxX - o.minX, H = o.maxY - o.minY
    return {
        minX: o.minX + r.l * W,
        maxX: o.minX + r.r * W,
        maxY: o.maxY - r.t * H,
        minY: o.maxY - r.b * H,
    }
}

const HANDLES = [
    { key: 'tl', x: 'l', y: 't', cursor: 'nwse-resize' },
    { key: 'tr', x: 'r', y: 't', cursor: 'nesw-resize' },
    { key: 'bl', x: 'l', y: 'b', cursor: 'nesw-resize' },
    { key: 'br', x: 'r', y: 'b', cursor: 'nwse-resize' },
]

export default function PlanCropModal({ planShapes, color, onApply, onClose }) {
    const original = planShapes.originalBbox || planShapes.bbox
    const [rect, setRect] = useState(() => bboxToRect(planShapes.bbox, original))
    const dragRef = useRef(null)

    const { width: iw, height: ih } = planDecalSize(original)
    const src = planDecalImage(planShapes.shapes, original, color)

    // Fit the preview inside 560x420 at the plan's own aspect ratio.
    const scale = Math.min(560 / iw, 420 / ih)
    const pw = Math.max(80, Math.round(iw * scale))
    const ph = Math.max(80, Math.round(ih * scale))

    useEffect(() => {
        function onMove(e) {
            const d = dragRef.current
            if (!d) return
            const dx = (e.clientX - d.x) / pw
            const dy = (e.clientY - d.y) / ph
            const s = d.start
            if (d.mode === 'move') {
                const w = s.r - s.l, h = s.b - s.t
                const l = Math.min(1 - w, Math.max(0, s.l + dx))
                const t = Math.min(1 - h, Math.max(0, s.t + dy))
                setRect({ l, r: l + w, t, b: t + h })
                return
            }
            const next = { ...s }
            if (d.x0 === 'l') next.l = Math.min(s.r - MIN_FRAC, clamp01(s.l + dx))
            else              next.r = Math.max(s.l + MIN_FRAC, clamp01(s.r + dx))
            if (d.y0 === 't') next.t = Math.min(s.b - MIN_FRAC, clamp01(s.t + dy))
            else              next.b = Math.max(s.t + MIN_FRAC, clamp01(s.b + dy))
            setRect(next)
        }
        function onUp() { dragRef.current = null }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        return () => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
        }
    }, [pw, ph])

    function startDrag(e, mode, handle) {
        e.preventDefault(); e.stopPropagation()
        dragRef.current = { mode, x0: handle?.x, y0: handle?.y, x: e.clientX, y: e.clientY, start: rect }
    }

    const full = rect.l <= 0 && rect.t <= 0 && rect.r >= 1 && rect.b >= 1

    return (
        <div data-keep-popup className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl border border-editor-border shadow-2xl p-6 max-w-[640px] w-full space-y-4">
                <div>
                    <p className="text-editor-lg font-semibold text-editor-ink">Crop site plan</p>
                    <p className="text-editor-sm text-editor-ink-muted mt-0.5">Drag the box to move it, or a corner to resize. Only what's inside is shown.</p>
                </div>

                <div className="flex justify-center">
                    <div className="relative select-none bg-editor-subtle rounded-lg overflow-hidden touch-none" style={{ width: pw, height: ph }}>
                        <img src={src} alt="" draggable={false} className="absolute inset-0 w-full h-full"/>
                        {/* Dim everything outside the crop box. */}
                        <div className="absolute inset-0 pointer-events-none" style={{
                            background: 'rgba(15,15,20,.45)',
                            clipPath: `polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,${rect.l * 100}% ${rect.t * 100}%,${rect.l * 100}% ${rect.b * 100}%,${rect.r * 100}% ${rect.b * 100}%,${rect.r * 100}% ${rect.t * 100}%,${rect.l * 100}% ${rect.t * 100}%)`,
                        }}/>
                        <div onPointerDown={e => startDrag(e, 'move')}
                             className="absolute border-2 border-editor-primary cursor-move"
                             style={{ left: `${rect.l * 100}%`, top: `${rect.t * 100}%`, width: `${(rect.r - rect.l) * 100}%`, height: `${(rect.b - rect.t) * 100}%` }}>
                            {HANDLES.map(h => (
                                <div key={h.key} onPointerDown={e => startDrag(e, 'resize', h)}
                                     className="absolute w-3.5 h-3.5 bg-white border-2 border-editor-primary rounded-sm"
                                     style={{
                                         cursor: h.cursor,
                                         left: h.x === 'l' ? -8 : undefined, right: h.x === 'r' ? -8 : undefined,
                                         top: h.y === 't' ? -8 : undefined, bottom: h.y === 'b' ? -8 : undefined,
                                     }}/>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 pt-1">
                    <button onClick={() => setRect({ l: 0, t: 0, r: 1, b: 1 })} disabled={full}
                            className="h-9 px-4 text-editor-base rounded-xl border border-editor-border text-editor-ink-muted hover:bg-editor-subtle transition-colors disabled:opacity-40">
                        Reset
                    </button>
                    <div className="flex-1"/>
                    <button onClick={onClose}
                            className="h-9 px-4 text-editor-base rounded-xl border border-editor-border text-editor-ink-muted hover:bg-editor-subtle transition-colors">
                        Cancel
                    </button>
                    <button onClick={() => onApply(rectToBbox(rect, original))}
                            className="h-9 px-4 text-editor-base rounded-xl bg-editor-primary text-white font-semibold hover:bg-editor-primary-hover transition-colors">
                        Apply crop
                    </button>
                </div>
            </div>
        </div>
    )
}
