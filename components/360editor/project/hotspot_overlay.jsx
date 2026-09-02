'use client'
// components/360editor/project/hotspot_overlay.jsx
// HotspotPopup — the floating form/saved card rendered next to the
// placement pin on top of the PSV canvas in the editor.

import { ARROWS } from '@/components/360editor/project/hotspot_panel'

function Spinner({ size = 10 }) {
    return (
        <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24"
             fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
    )
}

// ─── HotspotPopup ─────────────────────────────────────────────────────────────
// Floating card next to the crosshair pin. Three modes:
//   'new'            — form to create a new hotspot
//   'edit-existing'  — form pre-filled with existing hotspot data (entered
//                      directly on click — the on-canvas bounding box you're
//                      already looking at IS the "are you sure", so there's
//                      no separate confirm step)
//   'saved'          — confirmation after save (new or edit)
// Position/size/rotation are set by dragging the bounding box on the canvas
// (middle.jsx), not by fields in here — this form only holds what can't be
// set by dragging: the label and which scene it links to.

export function HotspotPopup({ pos, viewerSize, state, scenes, activeSceneId, halfSize = 0, onUpdate, onSave, onCancel, saving }) {
    if (!pos) return null

    const POPUP_W = 224
    // Used only to keep the card inside the viewer (see the vertical clamp
    // below) — has to be >= the card's real rendered height or the clamp
    // lets the bottom (Cancel/Save) sit past the edge of the window. Form
    // mode: header (~36) + padding (24) + Label row (~46) + Links-to row
    // (~46) + gaps (20) + buttons (28) = ~200, +buffer. Saved mode: header
    // (36) + padding (24) + 3 text lines (~49) + gap (8) + Close button
    // (28) = ~145, +buffer.
    const POPUP_H = state.mode === 'saved' ? 160 : 220

    // Prefer right of pin; fall back to left if near the edge. GAP is
    // measured from the edge of the bounding box, not the pin's center —
    // halfSize, plus 8px so the corner/rotate handles (which sit right on
    // that edge) clear too — otherwise the card overlaps the box on
    // anything but a tiny hotspot.
    const GAP     = 32 + halfSize + 8
    const goLeft  = pos.x + GAP + POPUP_W > viewerSize.w - 8
    const offsetX = goLeft ? -(GAP + POPUP_W) : GAP

    // Clamp vertically so the popup stays inside the viewer
    let offsetY  = -(POPUP_H / 2)
    const absTop = pos.y + offsetY
    if (absTop < 8)                          offsetY = 8 - pos.y
    if (absTop + POPUP_H > viewerSize.h - 8) offsetY = viewerSize.h - 8 - POPUP_H - pos.y

    const isForm  = state.mode === 'new' || state.mode === 'edit-existing'
    const hotspot = state.hotspot
    const arrow   = isForm
        ? ARROWS.find(a => a.type === state.arrow_type)
        : ARROWS.find(a => a.type === hotspot?.arrow_type)

    const headerLabel = {
        'new':           'New direction',
        'edit-existing': 'Edit direction',
        'saved':         state.isEdit ? 'Hotspot updated' : 'Hotspot saved',
    }[state.mode]

    return (
        <div className="absolute z-40 pointer-events-auto"
             style={{ left: pos.x + offsetX, top: pos.y + offsetY, width: POPUP_W }}>

            {/* dashed line connecting popup to pin */}
            <svg className="absolute pointer-events-none overflow-visible"
                 style={{ top: POPUP_H / 2, left: goLeft ? POPUP_W : 0, width: 0, height: 0 }}>
                <line x1="0" y1="0" x2={goLeft ? GAP : -GAP} y2="0"
                      stroke="rgba(55,48,163,0.4)" strokeWidth="1.5" strokeDasharray="3 2"/>
            </svg>

            <div className="bg-white/95 backdrop-blur-md rounded-xl border border-editor-border
                            shadow-editor-popup overflow-hidden">

                {/* ── Header ── */}
                <div className="flex items-center gap-2 px-3 py-2 bg-editor-primary/6 border-b border-editor-border">
                    {arrow && <img src={arrow.gif} alt={arrow.label} className="w-5 h-5 object-contain shrink-0 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"/>}
                    <span className="text-[11px] font-bold text-editor-primary flex-1">{headerLabel}</span>
                    {state.mode === 'saved' && (
                        <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                                <path d="M20 6L9 17l-5-5"/>
                            </svg>
                        </div>
                    )}
                </div>

                {/* ── New / Edit form ── */}
                {isForm && (
                    <div className="px-3 py-3 space-y-2.5">
                        <div className="space-y-1">
                            <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Label</label>
                            <input
                                autoFocus
                                value={state.label}
                                onChange={e => onUpdate({ ...state, label: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter' && state.target_scene_id) onSave() }}
                                placeholder="e.g. Go to Kitchen"
                                className="w-full h-7 bg-editor-surface border border-editor-border rounded-lg px-2.5
                                           text-[12px] text-editor-ink focus:outline-none focus:border-editor-primary
                                           placeholder:text-editor-ink-muted"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Links to</label>
                            <select
                                value={state.target_scene_id || ''}
                                onChange={e => onUpdate({ ...state, target_scene_id: e.target.value })}
                                className="w-full h-7 bg-editor-surface border border-editor-border rounded-lg px-2
                                           text-[12px] text-editor-ink focus:outline-none focus:border-editor-primary"
                            >
                                <option value="">— select scene —</option>
                                {scenes.filter(s => s.id !== activeSceneId).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-1.5">
                            <button onClick={onCancel}
                                    className="flex-1 h-7 text-[11px] rounded-lg border border-editor-border
                                               text-editor-ink-muted hover:bg-editor-subtle transition-colors">
                                Cancel
                            </button>
                            <button onClick={onSave} disabled={!state.target_scene_id || saving}
                                    className="flex-1 h-7 text-[11px] rounded-lg bg-editor-primary text-white
                                               font-semibold hover:bg-editor-primary-hover disabled:opacity-40
                                               transition-colors flex items-center justify-center gap-1">
                                {saving ? <><Spinner/>Saving…</> : 'Save'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Saved confirmation ── */}
                {state.mode === 'saved' && (
                    <div className="px-3 py-3 space-y-2">
                        <div>
                            <p className="text-[12px] font-semibold text-editor-ink truncate">
                                {state.hotspot?.label || 'Untitled'}
                            </p>
                            <p className="text-[11px] text-editor-ink-muted mt-0.5">
                                → {scenes.find(s => s.id === state.hotspot?.target_scene_id)?.name || 'Unknown'}
                            </p>
                            <p className="text-[10px] font-mono text-editor-ink-muted mt-1">
                                p:{state.hotspot?.pitch.toFixed(1)}° y:{state.hotspot?.yaw.toFixed(1)}°
                            </p>
                        </div>
                        <button onClick={onCancel}
                                className="w-full h-7 text-[11px] rounded-lg border border-editor-border
                                           text-editor-ink-muted hover:bg-editor-subtle transition-colors">
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}