'use client'
// components/360editor/project/polygon_overlay.jsx
// PolygonPopup — the floating card for a polygon zone, rendered next to its
// centroid on top of the PSV canvas. Points are immutable once drawn (the
// shape comes from the draw flow in middle.jsx); this popup only edits the
// status/label/detail metadata, and doubles as the click-to-view detail card.
//
// Three modes:
//   'new'  — form to create a new zone (shown right after Finish in the draw flow)
//   'view' — read-only detail card for an existing zone (opened by clicking it)
//   'edit' — same form as 'new', pre-filled, reached from 'view's Edit button
import { useState } from 'react'
import { STATUS_COLORS, DEFAULT_STATUS_COLOR, colorForStatus, MAX_DETAIL_KEYS } from '@/lib/polygons'

function Spinner({ size = 10 }) {
    return (
        <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24"
             fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
    )
}

const STATUS_OPTIONS = Object.keys(STATUS_COLORS)

function StatusSwatch({ status }) {
    return <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorForStatus(status) }}/>
}

// A small, dynamic key/value row editor for the "detail" payload (price,
// size, notes — whatever the zone needs). Rows are edited as a local array so
// typing a key doesn't fight object-key reordering; onChange fires the
// reduced object up on every edit.
function DetailFields({ detail, onChange }) {
    const [rows, setRows] = useState(() => Object.entries(detail || {}).map(([k, v]) => ({ k, v: String(v) })))

    function commit(next) {
        setRows(next)
        const obj = {}
        for (const { k, v } of next) if (k.trim()) obj[k.trim()] = v
        onChange(obj)
    }

    return (
        <div className="space-y-1.5">
            <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Details</label>
            {rows.map((row, i) => (
                <div key={i} className="flex gap-1.5">
                    <input value={row.k} placeholder="Field"
                           onChange={e => commit(rows.map((r, j) => j === i ? { ...r, k: e.target.value } : r))}
                           className="w-[72px] shrink-0 h-7 bg-editor-surface border border-editor-border rounded-lg px-2 text-[11px] text-editor-ink focus:outline-none focus:border-editor-primary placeholder:text-editor-ink-dim"/>
                    <input value={row.v} placeholder="Value"
                           onChange={e => commit(rows.map((r, j) => j === i ? { ...r, v: e.target.value } : r))}
                           className="flex-1 h-7 bg-editor-surface border border-editor-border rounded-lg px-2 text-[11px] text-editor-ink focus:outline-none focus:border-editor-primary placeholder:text-editor-ink-dim"/>
                    <button onClick={() => commit(rows.filter((_, j) => j !== i))}
                            className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-editor-ink-dim hover:text-red-500 hover:bg-red-50 transition-colors">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                </div>
            ))}
            {rows.length < MAX_DETAIL_KEYS && (
                <button onClick={() => commit([...rows, { k: '', v: '' }])}
                        className="text-[10.5px] font-semibold text-editor-primary hover:text-editor-primary-hover transition-colors">
                    + Add field
                </button>
            )}
        </div>
    )
}

export function PolygonPopup({ pos, viewerSize, state, onUpdate, onSave, onEdit, onDelete, onCancel, saving, deleting }) {
    if (!pos) return null

    const isForm = state.mode === 'new' || state.mode === 'edit'
    const POPUP_W = 232
    const POPUP_H = isForm ? 300 : 150

    const GAP     = 20
    const goLeft  = pos.x + GAP + POPUP_W > viewerSize.w - 8
    const offsetX = goLeft ? -(GAP + POPUP_W) : GAP

    let offsetY  = -(POPUP_H / 2)
    const absTop = pos.y + offsetY
    if (absTop < 8)                          offsetY = 8 - pos.y
    if (absTop + POPUP_H > viewerSize.h - 8) offsetY = viewerSize.h - 8 - POPUP_H - pos.y

    const headerLabel = { new: 'New zone', view: state.polygon?.label || 'Zone', edit: 'Edit zone' }[state.mode]

    return (
        <div className="absolute z-40 pointer-events-auto"
             style={{ left: pos.x + offsetX, top: pos.y + offsetY, width: POPUP_W }}
             onMouseDown={e => e.stopPropagation()}>

            <svg className="absolute pointer-events-none overflow-visible"
                 style={{ top: POPUP_H / 2, left: goLeft ? POPUP_W : 0, width: 0, height: 0 }}>
                <line x1="0" y1="0" x2={goLeft ? GAP : -GAP} y2="0"
                      stroke="rgba(55,48,163,0.4)" strokeWidth="1.5" strokeDasharray="3 2"/>
            </svg>

            <div className="bg-white/95 backdrop-blur-md rounded-xl border border-editor-border shadow-editor-popup overflow-hidden">

                <div className="flex items-center gap-2 px-3 py-2 bg-editor-primary/6 border-b border-editor-border">
                    {!isForm && <StatusSwatch status={state.polygon?.status}/>}
                    <span className="text-[11px] font-bold text-editor-primary flex-1 truncate">{headerLabel}</span>
                    <button onClick={onCancel} className="text-editor-ink-dim hover:text-editor-ink transition-colors shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                </div>

                {isForm && (
                    <div className="px-3 py-3 space-y-2.5 max-h-[360px] overflow-y-auto">
                        <div className="space-y-1">
                            <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Label</label>
                            <input autoFocus value={state.label}
                                   onChange={e => onUpdate({ ...state, label: e.target.value })}
                                   placeholder="e.g. Unit 4B"
                                   className="w-full h-7 bg-editor-surface border border-editor-border rounded-lg px-2.5 text-[12px] text-editor-ink focus:outline-none focus:border-editor-primary placeholder:text-editor-ink-muted"/>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Status</label>
                            <div className="flex flex-wrap gap-1.5">
                                {STATUS_OPTIONS.map(s => (
                                    <button key={s} onClick={() => onUpdate({ ...state, status: s })}
                                            className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                                                state.status === s ? 'border-editor-primary bg-editor-primary/8 text-editor-primary' : 'border-editor-border text-editor-ink-muted hover:border-editor-primary/40'
                                            }`}>
                                        <StatusSwatch status={s}/>{s}
                                    </button>
                                ))}
                            </div>
                            <input value={STATUS_OPTIONS.includes(state.status) ? '' : state.status}
                                   onChange={e => onUpdate({ ...state, status: e.target.value })}
                                   placeholder="or type a custom status"
                                   className="w-full h-7 bg-editor-surface border border-editor-border rounded-lg px-2.5 text-[11px] text-editor-ink focus:outline-none focus:border-editor-primary placeholder:text-editor-ink-dim"/>
                        </div>
                        <DetailFields detail={state.detail} onChange={detail => onUpdate({ ...state, detail })}/>
                        <div className="flex gap-1.5 pt-1">
                            <button onClick={onCancel}
                                    className="flex-1 h-7 text-[11px] rounded-lg border border-editor-border text-editor-ink-muted hover:bg-editor-subtle transition-colors">
                                Cancel
                            </button>
                            <button onClick={onSave} disabled={saving || !state.label.trim()}
                                    className="flex-1 h-7 text-[11px] rounded-lg bg-editor-primary text-white font-semibold hover:bg-editor-primary-hover disabled:opacity-40 transition-colors flex items-center justify-center gap-1">
                                {saving ? <><Spinner/>Saving…</> : 'Save'}
                            </button>
                        </div>
                    </div>
                )}

                {state.mode === 'view' && state.polygon && (
                    <div className="px-3 py-3 space-y-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-editor-ink-muted">
                            <StatusSwatch status={state.polygon.status}/>
                            <span className="capitalize">{state.polygon.status}</span>
                        </div>
                        {Object.keys(state.polygon.detail || {}).length > 0 && (
                            <div className="space-y-1">
                                {Object.entries(state.polygon.detail).map(([k, v]) => (
                                    <div key={k} className="flex justify-between gap-2 text-[11px]">
                                        <span className="text-editor-ink-dim">{k}</span>
                                        <span className="text-editor-ink font-medium truncate">{String(v)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-1.5 pt-1">
                            <button onClick={onDelete} disabled={deleting}
                                    className="flex-1 h-7 text-[11px] rounded-lg border border-editor-border text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors">
                                {deleting ? <Spinner/> : 'Delete'}
                            </button>
                            <button onClick={onEdit}
                                    className="flex-1 h-7 text-[11px] rounded-lg bg-editor-primary text-white font-semibold hover:bg-editor-primary-hover transition-colors">
                                Edit
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
