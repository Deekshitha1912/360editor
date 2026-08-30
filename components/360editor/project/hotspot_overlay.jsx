'use client'
// components/360editor/project/hotspot_overlay.jsx
// HotspotPopup — the floating form/confirm/saved card rendered next to the
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
// Floating card next to the crosshair pin. Four modes:
//   'new'            — form to create a new hotspot
//   'confirm-edit'   — "Edit this hotspot?" yes/no
//   'edit-existing'  — form pre-filled with existing hotspot data
//   'saved'          — confirmation after save (new or edit)

export function HotspotPopup({ pos, viewerSize, state, scenes, activeSceneId, onUpdate, onSave, onCancel, saving }) {
    if (!pos) return null

    const POPUP_W = 224
    const POPUP_H = (state.mode === 'confirm-edit' || state.mode === 'saved') ? 120 : 200

    // Prefer right of pin; fall back to left if near the edge
    const GAP     = 32
    const goLeft  = pos.x + GAP + POPUP_W > viewerSize.w - 8
    const offsetX = goLeft ? -(GAP + POPUP_W) : GAP

    // Clamp vertically so the popup stays inside the viewer
    let offsetY  = -(POPUP_H / 2)
    const absTop = pos.y + offsetY
    if (absTop < 8)                          offsetY = 8 - pos.y
    if (absTop + POPUP_H > viewerSize.h - 8) offsetY = viewerSize.h - 8 - POPUP_H - pos.y

    const isForm      = state.mode === 'new' || state.mode === 'edit-existing'
    const hotspot     = state.hotspot
    const arrow       = isForm
        ? ARROWS.find(a => a.type === state.arrow_type)
        : ARROWS.find(a => a.type === hotspot?.arrow_type)
    const targetScene = hotspot ? scenes.find(s => s.id === hotspot.target_scene_id) : null

    const headerLabel = {
        'new':           'New direction',
        'confirm-edit':  'Edit hotspot?',
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

            <div className="bg-white/95 backdrop-blur-md rounded-xl border border-[#E2E2DA]
                            shadow-[0_8px_32px_rgba(0,0,0,0.18)] overflow-hidden">

                {/* ── Header ── */}
                <div className="flex items-center gap-2 px-3 py-2 bg-[#3730a3]/6 border-b border-[#E2E2DA]">
                    {arrow && <img src={arrow.jpg} alt={arrow.label} className="w-5 h-5 object-contain shrink-0"/>}
                    <span className="text-[11px] font-bold text-[#3730a3] flex-1">{headerLabel}</span>
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
                            <label className="text-[10px] text-[#6b6b60] uppercase tracking-wider font-medium">Label</label>
                            <input
                                autoFocus
                                value={state.label}
                                onChange={e => onUpdate({ ...state, label: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter' && state.target_scene_id) onSave() }}
                                placeholder="e.g. Go to Kitchen"
                                className="w-full h-7 bg-[#FAFAF7] border border-[#E2E2DA] rounded-lg px-2.5
                                           text-[12px] text-[#1a1a18] focus:outline-none focus:border-[#3730a3]
                                           placeholder:text-[#6b6b60]"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-[#6b6b60] uppercase tracking-wider font-medium">Links to</label>
                            <select
                                value={state.target_scene_id || ''}
                                onChange={e => onUpdate({ ...state, target_scene_id: e.target.value })}
                                className="w-full h-7 bg-[#FAFAF7] border border-[#E2E2DA] rounded-lg px-2
                                           text-[12px] text-[#1a1a18] focus:outline-none focus:border-[#3730a3]"
                            >
                                <option value="">— select scene —</option>
                                {scenes.filter(s => s.id !== activeSceneId).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1 bg-[#F4F4EF] rounded-lg px-2 py-1">
                                <p className="text-[9px] text-[#6b6b60] uppercase tracking-wider">Pitch</p>
                                <p className="text-[11px] font-mono text-[#1a1a18]">{state.pitch.toFixed(1)}°</p>
                            </div>
                            <div className="flex-1 bg-[#F4F4EF] rounded-lg px-2 py-1">
                                <p className="text-[9px] text-[#6b6b60] uppercase tracking-wider">Yaw</p>
                                <p className="text-[11px] font-mono text-[#1a1a18]">{state.yaw.toFixed(1)}°</p>
                            </div>
                        </div>
                        <div className="flex gap-1.5">
                            <button onClick={onCancel}
                                    className="flex-1 h-7 text-[11px] rounded-lg border border-[#E2E2DA]
                                               text-[#6b6b60] hover:bg-[#F4F4EF] transition-colors">
                                Cancel
                            </button>
                            <button onClick={onSave} disabled={!state.target_scene_id || saving}
                                    className="flex-1 h-7 text-[11px] rounded-lg bg-[#3730a3] text-white
                                               font-semibold hover:bg-[#312e81] disabled:opacity-40
                                               transition-colors flex items-center justify-center gap-1">
                                {saving ? <><Spinner/>Saving…</> : 'Save'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Confirm edit ── */}
                {state.mode === 'confirm-edit' && hotspot && (
                    <div className="px-3 py-3 space-y-2.5">
                        <div>
                            <p className="text-[12px] font-semibold text-[#1a1a18] truncate">
                                {hotspot.label || 'Untitled'}
                            </p>
                            <p className="text-[11px] text-[#6b6b60] mt-0.5">
                                → {targetScene?.name || 'Unknown scene'}
                            </p>
                        </div>
                        <p className="text-[11px] text-[#6b6b60]">Edit this hotspot?</p>
                        <div className="flex gap-1.5">
                            <button onClick={onCancel}
                                    className="flex-1 h-7 text-[11px] rounded-lg border border-[#E2E2DA]
                                               text-[#6b6b60] hover:bg-[#F4F4EF] transition-colors">
                                No
                            </button>
                            <button
                                onClick={() => onUpdate({
                                    mode:            'edit-existing',
                                    hotspot,
                                    arrow_type:      hotspot.arrow_type,
                                    pitch:           hotspot.pitch,
                                    yaw:             hotspot.yaw,
                                    label:           hotspot.label || '',
                                    target_scene_id: hotspot.target_scene_id,
                                    size:            hotspot.size ?? 120,
                                })}
                                className="flex-1 h-7 text-[11px] rounded-lg bg-[#3730a3] text-white
                                           font-semibold hover:bg-[#312e81] transition-colors">
                                Yes, edit
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Saved confirmation ── */}
                {state.mode === 'saved' && (
                    <div className="px-3 py-3 space-y-2">
                        <div>
                            <p className="text-[12px] font-semibold text-[#1a1a18] truncate">
                                {state.hotspot?.label || 'Untitled'}
                            </p>
                            <p className="text-[11px] text-[#6b6b60] mt-0.5">
                                → {scenes.find(s => s.id === state.hotspot?.target_scene_id)?.name || 'Unknown'}
                            </p>
                            <p className="text-[10px] font-mono text-[#6b6b60] mt-1">
                                p:{state.hotspot?.pitch.toFixed(1)}° y:{state.hotspot?.yaw.toFixed(1)}°
                            </p>
                        </div>
                        <button onClick={onCancel}
                                className="w-full h-7 text-[11px] rounded-lg border border-[#E2E2DA]
                                           text-[#6b6b60] hover:bg-[#F4F4EF] transition-colors">
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}