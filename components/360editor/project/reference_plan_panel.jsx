'use client'
// components/360editor/project/reference_plan_panel.jsx
//
// The "Reference plan" section at the top of the Zones panel — import a DXF
// site/floor plan, calibrate it against the photo by clicking point pairs,
// trace zones over it, then delete it.
//
// EDITOR ONLY. The plan is never published, never reaches export.jsx, and
// never lands in the downloaded zip. See lib/reference-plan.js for the
// geometry and db/015_add_scene_reference_plan.sql for the stored shape.
//
// Calibration is a two-step click: pick a vertex on the flat mini-map here,
// then click the same corner in the photo. Two pairs solve the plan→ground
// transform exactly; more are least-squares fitted and start reporting a
// meaningful average error.

import { useRef, useState } from 'react'

const MINI_W = 208
const MINI_MAX_H = 150
const MINI_PAD = 10
// Past this many points the per-vertex dots are dropped — they're only
// decoration (clicks are hit-tested in JS, not per-circle), and a few
// thousand SVG nodes is a real render cost for no benefit.
const MAX_VERTEX_DOTS = 300

// Maps raw DXF coordinates into the mini-map's pixel box. The Y flip is
// DISPLAY ONLY — stored geometry stays Y-up, because flipping it would be a
// reflection, which the similarity fit in lib/reference-plan.js cannot
// represent.
function miniMapFor(bbox) {
    const w = Math.max(bbox.maxX - bbox.minX, 1e-9)
    const h = Math.max(bbox.maxY - bbox.minY, 1e-9)
    const scale = Math.min((MINI_W - MINI_PAD * 2) / w, (MINI_MAX_H - MINI_PAD * 2) / h)
    const height = Math.max(40, Math.min(MINI_MAX_H, h * scale + MINI_PAD * 2))
    return {
        width: MINI_W,
        height,
        to: ([x, y]) => [
            MINI_PAD + (x - bbox.minX) * scale,
            height - MINI_PAD - (y - bbox.minY) * scale,
        ],
    }
}

export default function ReferencePlanPanel({
                                               plan, pendingPoint, residual, hasActiveScene, error,
                                               onImport, onPickPlanPoint, onCancelPending,
                                               onRemovePair, onUpdateFlags, onDelete,
                                           }) {
    const fileRef = useRef(null)
    const [busy, setBusy] = useState(false)
    const [localError, setLocalError] = useState('')
    const [open, setOpen] = useState(true)

    async function pick(file) {
        if (!file) return
        setLocalError('')
        setBusy(true)
        try {
            const err = await onImport(file)
            if (err) setLocalError(err)
        } finally {
            setBusy(false)
        }
    }

    const shown = error || localError

    if (!plan) {
        return (
            <div className="px-3 pt-3">
                <button
                    onClick={() => fileRef.current?.click()}
                    disabled={busy || !hasActiveScene}
                    className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-editor-border-dashed rounded-xl py-2.5 text-[11px] font-semibold text-editor-ink-dim hover:border-editor-primary/50 hover:text-editor-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    {busy ? 'Reading…' : (
                        <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                            Import site plan
                        </>
                    )}
                </button>
                <p className="mt-1 text-[9.5px] text-editor-ink-dim text-center leading-snug">
                    {hasActiveScene
                        ? 'A .dxf file (not .dwg) to trace zones over, then delete.'
                        : 'Open a scene first.'}
                </p>
                {shown && <p className="mt-1 text-[10px] text-red-600 leading-snug">{shown}</p>}
                <input ref={fileRef} type="file" accept=".dxf" hidden
                       onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }}/>
            </div>
        )
    }

    const pairs = plan.pairs || []
    const shapes = plan.shapes || []
    const mini = miniMapFor(plan.bbox)
    const totalPoints = shapes.reduce((n, s) => n + (s.pts?.length || 0), 0)
    const showDots = totalPoints <= MAX_VERTEX_DOTS

    // Always snaps to a real vertex — the plan is the only thing in this box,
    // so there's nothing else a click could sensibly mean.
    function pickNearestVertex(e) {
        const rect = e.currentTarget.getBoundingClientRect()
        const mx = e.clientX - rect.left, my = e.clientY - rect.top
        let best = null, bestD = Infinity
        for (const s of shapes) {
            for (const pt of s.pts || []) {
                const [px, py] = mini.to(pt)
                const d = (px - mx) ** 2 + (py - my) ** 2
                if (d < bestD) { bestD = d; best = pt }
            }
        }
        if (best) onPickPlanPoint(best)
    }

    return (
        <div className="px-3 pt-3">
            <div className="rounded-xl border border-editor-border bg-white overflow-hidden">

                <button onClick={() => setOpen(o => !o)}
                        className="w-full flex items-center gap-1.5 px-2.5 py-2 hover:bg-editor-canvas transition-colors">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                         className={`text-editor-icon-idle shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}>
                        <path d="M9 18l6-6-6-6"/>
                    </svg>
                    <span className="text-[11px] font-bold text-editor-ink flex-1 text-left truncate">Reference plan</span>
                    <span className={`text-[9.5px] font-semibold px-1.5 py-0.5 rounded ${
                        pairs.length >= 2 ? 'bg-cyan-50 text-cyan-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                        {pairs.length >= 2 ? 'Calibrated' : `${pairs.length}/2 points`}
                    </span>
                </button>

                {open && (
                    <div className="px-2.5 pb-2.5 space-y-2">
                        <p className="text-[10px] text-editor-ink-dim truncate" title={plan.name}>{plan.name}</p>

                        {/* Flat mini-map — click a corner, then its match in the photo. */}
                        <div className="rounded-lg border border-editor-border bg-editor-canvas overflow-hidden">
                            <svg width={mini.width} height={mini.height} className="block cursor-crosshair"
                                 onClick={pickNearestVertex}>
                                {shapes.map((s, i) => {
                                    const d = (s.pts || []).map(p => mini.to(p).join(',')).join(' ')
                                    return s.tag === 'polygon'
                                        ? <polygon key={i} points={d} fill="none" stroke="#0e7490" strokeWidth="1"/>
                                        : <polyline key={i} points={d} fill="none" stroke="#0e7490" strokeWidth="1"/>
                                })}
                                {showDots && shapes.flatMap((s, i) =>
                                    (s.pts || []).map((pt, j) => {
                                        const [cx, cy] = mini.to(pt)
                                        return <circle key={`${i}-${j}`} cx={cx} cy={cy} r="1.5" fill="#0e7490" opacity="0.5"/>
                                    })
                                )}
                                {/* Paired corners, numbered to match the list below. */}
                                {pairs.map((p, i) => {
                                    const [cx, cy] = mini.to(p.plan)
                                    return (
                                        <g key={`pair-${i}`}>
                                            <circle cx={cx} cy={cy} r="5" fill="#0891b2"/>
                                            <text x={cx} y={cy + 2.5} textAnchor="middle" fontSize="7" fill="#fff" fontWeight="700">{i + 1}</text>
                                        </g>
                                    )
                                })}
                                {pendingPoint && (() => {
                                    const [cx, cy] = mini.to(pendingPoint)
                                    return <circle cx={cx} cy={cy} r="6" fill="none" stroke="#f59e0b" strokeWidth="2"/>
                                })()}
                            </svg>
                        </div>

                        {pendingPoint ? (
                            <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5">
                                <span className="text-[10px] text-amber-800 leading-snug flex-1">
                                    Now click that same corner in the photo.
                                </span>
                                <button onClick={onCancelPending}
                                        className="text-[10px] font-semibold text-amber-800 hover:underline shrink-0">
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <p className="text-[10px] text-editor-ink-dim leading-snug">
                                {pairs.length >= 2
                                    ? 'Add another point to refine the fit.'
                                    : 'Click a corner above, then the same corner in the photo.'}
                            </p>
                        )}

                        {pairs.length > 0 && (
                            <div className="space-y-1">
                                {pairs.map((p, i) => (
                                    <div key={i} className="flex items-center gap-1.5 text-[10px] text-editor-ink-muted">
                                        <span className="w-4 h-4 rounded-full bg-cyan-600 text-white font-bold flex items-center justify-center shrink-0 text-[8px]">{i + 1}</span>
                                        <span className="flex-1 font-mono truncate">
                                            {p.yaw.toFixed(1)}°, {p.pitch.toFixed(1)}°
                                        </span>
                                        <button onClick={() => onRemovePair(i)} title="Remove this point"
                                                className="w-5 h-5 rounded flex items-center justify-center text-editor-icon-idle hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Two pairs are solved exactly, so their residual is always
                            ~0 and showing it would mislead — only rendered from
                            three up (middle.jsx decides, and passes null below that). */}
                        {residual != null && (
                            <p className={`text-[10px] ${residual > 2 ? 'text-amber-700' : 'text-editor-ink-dim'}`}>
                                Average error: ±{residual.toFixed(2)}°
                                {residual > 2 && ' — check for a misplaced point.'}
                            </p>
                        )}

                        <div className="flex items-center gap-3 pt-0.5">
                            <label className="flex items-center gap-1.5 text-[10px] text-editor-ink cursor-pointer">
                                <input type="checkbox" checked={plan.visible !== false}
                                       onChange={e => onUpdateFlags({ visible: e.target.checked })}
                                       className="w-3 h-3 accent-editor-primary"/>
                                Show
                            </label>
                            <label className="flex items-center gap-1.5 text-[10px] text-editor-ink cursor-pointer"
                                   title="Flip the plan, for a drawing mirrored relative to the photo">
                                <input type="checkbox" checked={!!plan.mirror}
                                       onChange={e => onUpdateFlags({ mirror: e.target.checked })}
                                       className="w-3 h-3 accent-editor-primary"/>
                                Mirror
                            </label>
                            <button onClick={onDelete}
                                    className="ml-auto text-[10px] font-semibold text-red-500 hover:underline">
                                Delete
                            </button>
                        </div>

                        {shown && <p className="text-[10px] text-red-600 leading-snug">{shown}</p>}
                    </div>
                )}
            </div>
        </div>
    )
}
