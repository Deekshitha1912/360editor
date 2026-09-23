'use client'
// components/360editor/project/hotspot_panel.jsx
// RIGHT PANEL — arrow palette + saved hotspots list, OR (while a hotspot is
// being created/edited) the hotspot form itself, taking over this same
// panel in place of the palette+list. The form used to float as a separate
// popup card anchored next to the placement pin on the canvas; it lives
// here now instead, so editing a hotspot always means looking at the right
// panel — the same place its saved counterpart already lived — rather than
// a card that could land anywhere near the pin depending on where it was
// dropped.

import { useState } from 'react'
import { ARROWS } from '@/lib/arrows'
import { HOTSPOT_COLORS, LABEL_COLORS } from '@/lib/hotspots'
import InfoFieldsEditor from './info_fields_editor'
export { ARROWS }

function Spinner({ size = 10 }) {
    return (
        <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24"
             fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
    )
}

// ─── HotspotForm ────────────────────────────────────────────────────────────
// The 'new' / 'edit-existing' form. Position/size/rotation are still set by
// dragging the bounding box + gizmo on the canvas (middle.jsx) — this form
// only holds what can't be set by dragging: the label, the click action,
// and (for landmark/floor/pulse) color and rotation-axis fields.
function HotspotForm({ state, scenes, activeSceneId, hotspots, onUpdate, onSave, onCancel, onDelete, onUploadImage, saving, deleting, formRef }) {
    const [uploadingImage, setUploadingImage] = useState(false)
    const [uploadError, setUploadError] = useState('')

    const [uploadingIcon, setUploadingIcon] = useState(false)
    const [uploadIconError, setUploadIconError] = useState('')

    const isLandmarkForm = state.arrow_type === 'landmark'
    const isCustomForm = state.arrow_type === 'custom'
    const isTextForm = state.arrow_type === 'text'
    // 'floor' and 'text' (both real 3D-embedded imageLayer planes) and
    // 'pulse' (a plain animated billboard) all get the same Rotate X/Y/Z
    // sliders, matching the same 3-ring gizmo shown for all three on-canvas
    // (middle.jsx) — X/Y are cosmetically inert for pulse (a flat billboard
    // can't tilt), same "present but harmless" precedent as landmark's own
    // unused rotation.
    const showAxisSliders = state.arrow_type === 'floor' || state.arrow_type === 'pulse' || isTextForm
    const actionType = state.action_type || 'navigate'
    const arrow = ARROWS.find(a => a.type === state.arrow_type)
    const headerLabel = state.mode === 'edit-existing'
        ? (isTextForm ? 'Edit text' : 'Edit direction')
        : (isTextForm ? 'New text' : 'New direction')
    // Custom's own uploaded image stands in for the fixed sprite everywhere
    // that would otherwise show `arrow.gif` — the placeholder glyph only
    // shows until one's actually uploaded.
    const headerIconSrc = state.custom_icon_url || arrow?.gif

    return (
        <div ref={formRef} className="flex flex-col h-full overflow-y-auto bg-editor-panel border-l border-editor-border select-none">
            {/* ── Header ── */}
            {/* Back (← , same "leave without a separate full-width Cancel
                button" role zone's header X plays) on the left, Save on the
                right — replaces the old bottom Cancel/Save row so both
                actions sit next to the name you're actually editing. */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-editor-border shrink-0 bg-editor-primary/6">
                <button onClick={onCancel} aria-label="Back"
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-editor-ink-muted hover:text-editor-ink hover:bg-editor-subtle transition-colors shrink-0">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                {headerIconSrc && <img src={headerIconSrc} alt={arrow?.label || ''} className="w-5 h-5 object-contain shrink-0 rounded-sm drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"/>}
                <span className="text-[11px] font-bold text-editor-primary flex-1 truncate">{state.label || headerLabel}</span>
                <button onClick={onSave} disabled={saving}
                        className="h-7 px-3 shrink-0 text-[11px] rounded-lg bg-editor-primary text-white
                                   font-semibold hover:bg-editor-primary-hover disabled:opacity-40
                                   transition-colors flex items-center justify-center gap-1">
                    {saving ? <><Spinner/>Saving…</> : 'Save'}
                </button>
            </div>

            {/* ── Form ── */}
            <div className="px-3 py-3 space-y-2.5">
                <div className="space-y-1">
                    <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">
                        {isTextForm ? 'Text' : 'Label'}
                    </label>
                    <input
                        autoFocus
                        value={state.label}
                        onChange={e => onUpdate({ ...state, label: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') onSave() }}
                        placeholder={isTextForm ? 'Text to display on the surface' : 'e.g. Go to Kitchen'}
                        className="w-full h-7 bg-editor-surface border border-editor-border rounded-lg px-2.5
                                   text-[12px] text-editor-ink focus:outline-none focus:border-editor-primary
                                   placeholder:text-editor-ink-muted"
                    />
                    {isTextForm && (
                        <p className="text-[10.5px] text-editor-ink-dim leading-relaxed">
                            Rendered directly onto the surface — drag/resize/rotate it with the handles on the canvas, same as a floor decal.
                        </p>
                    )}
                </div>

                {isTextForm && (
                    <div className="space-y-1">
                        <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Text color</label>
                        <div className="flex gap-1.5">
                            {HOTSPOT_COLORS.map(c => (
                                <button key={c} type="button" onClick={() => onUpdate({ ...state, color: c })}
                                        aria-label={c}
                                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                                            (state.color || HOTSPOT_COLORS[0]) === c ? 'border-editor-ink scale-110' : 'border-white/60 hover:scale-105'
                                        }`}
                                        style={{ background: c, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}/>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-1">
                    <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">On click</label>
                    <select
                        value={actionType}
                        onChange={e => onUpdate({ ...state, action_type: e.target.value })}
                        className="w-full h-7 bg-editor-surface border border-editor-border rounded-lg px-2
                                   text-[12px] text-editor-ink focus:outline-none focus:border-editor-primary"
                    >
                        <option value="navigate">Go to scene</option>
                        <option value="link">Open link</option>
                        <option value="image">Open image</option>
                        <option value="info">Show info card</option>
                        <option value="toggle">Show/hide a hotspot</option>
                    </select>
                </div>

                {actionType === 'navigate' && (
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
                )}

                {actionType === 'link' && (
                    <div className="space-y-1">
                        <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">URL</label>
                        <input
                            value={state.link_url || ''}
                            onChange={e => onUpdate({ ...state, link_url: e.target.value })}
                            placeholder="https:// or mailto: or tel:"
                            className="w-full h-7 bg-editor-surface border border-editor-border rounded-lg px-2.5
                                       text-[12px] text-editor-ink focus:outline-none focus:border-editor-primary
                                       placeholder:text-editor-ink-muted"
                        />
                    </div>
                )}

                {actionType === 'image' && (
                    <div className="space-y-1">
                        <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Image</label>
                        {state.info_image_url ? (
                            <div className="flex items-center gap-1.5">
                                <img src={state.info_image_url} alt="" className="w-7 h-7 rounded object-cover border border-editor-border shrink-0"/>
                                <button type="button" onClick={() => onUpdate({ ...state, info_image_url: '' })}
                                        className="flex-1 h-7 text-[11px] rounded-lg border border-editor-border
                                                   text-editor-ink-muted hover:bg-editor-subtle transition-colors">
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <label className="flex items-center justify-center h-7 text-[11px] rounded-lg border border-dashed
                                               border-editor-border text-editor-ink-muted hover:bg-editor-subtle
                                               transition-colors cursor-pointer">
                                {uploadingImage ? <><Spinner/>&nbsp;Uploading…</> : 'Upload image'}
                                <input
                                    type="file" accept="image/*" className="hidden" disabled={uploadingImage}
                                    onChange={async e => {
                                        const file = e.target.files?.[0]
                                        e.target.value = ''
                                        if (!file || !onUploadImage) return
                                        setUploadingImage(true)
                                        setUploadError('')
                                        try {
                                            const url = await onUploadImage(file)
                                            if (url) onUpdate({ ...state, info_image_url: url })
                                        } catch (err) {
                                            setUploadError(err?.message || 'Upload failed.')
                                        } finally {
                                            setUploadingImage(false)
                                        }
                                    }}
                                />
                            </label>
                        )}
                        {uploadError && <p className="text-[10px] text-red-500">{uploadError}</p>}
                        <p className="text-[10.5px] text-editor-ink-dim leading-relaxed">
                            Opens centered, full-screen, with a close button — clicking outside it or the ✕ closes it.
                        </p>
                    </div>
                )}

                {actionType === 'info' && (
                    <InfoFieldsEditor
                        fields={state.info_fields}
                        onChange={info_fields => onUpdate({ ...state, info_fields })}
                        onUploadImage={onUploadImage}
                    />
                )}

                {actionType === 'toggle' && (
                    <div className="space-y-1">
                        <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Hotspot to show/hide</label>
                        <select
                            value={state.toggle_target_id || ''}
                            onChange={e => onUpdate({ ...state, toggle_target_id: e.target.value })}
                            className="w-full h-7 bg-editor-surface border border-editor-border rounded-lg px-2
                                       text-[12px] text-editor-ink focus:outline-none focus:border-editor-primary"
                        >
                            <option value="">— select hotspot —</option>
                            {hotspots
                                .filter(h => h.scene_id === activeSceneId && h.id !== state.hotspot?.id)
                                .map(h => (
                                    <option key={h.id} value={h.id}>{h.label || 'Untitled'}</option>
                                ))}
                        </select>
                    </div>
                )}

                <label className="flex items-center gap-1.5 text-[11px] text-editor-ink cursor-pointer">
                    <input
                        type="checkbox"
                        checked={!!state.start_hidden}
                        onChange={e => onUpdate({ ...state, start_hidden: e.target.checked })}
                        className="w-3.5 h-3.5 accent-editor-primary"
                    />
                    Starts hidden until revealed
                </label>

                {isCustomForm && (
                    <div className="space-y-1">
                        <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Icon image</label>
                        {state.custom_icon_url ? (
                            <div className="flex items-center gap-1.5">
                                <img src={state.custom_icon_url} alt="" className="w-7 h-7 rounded object-contain border border-editor-border shrink-0 bg-editor-surface"/>
                                <button type="button" onClick={() => onUpdate({ ...state, custom_icon_url: '' })}
                                        className="flex-1 h-7 text-[11px] rounded-lg border border-editor-border
                                                   text-editor-ink-muted hover:bg-editor-subtle transition-colors">
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <label className="flex items-center justify-center h-7 text-[11px] rounded-lg border border-dashed
                                               border-editor-border text-editor-ink-muted hover:bg-editor-subtle
                                               transition-colors cursor-pointer">
                                {uploadingIcon ? <><Spinner/>&nbsp;Uploading…</> : 'Upload image'}
                                <input
                                    type="file" accept="image/*" className="hidden" disabled={uploadingIcon}
                                    onChange={async e => {
                                        const file = e.target.files?.[0]
                                        e.target.value = ''
                                        if (!file || !onUploadImage) return
                                        setUploadingIcon(true)
                                        setUploadIconError('')
                                        try {
                                            const url = await onUploadImage(file)
                                            if (url) onUpdate({ ...state, custom_icon_url: url })
                                        } catch (err) {
                                            setUploadIconError(err?.message || 'Upload failed.')
                                        } finally {
                                            setUploadingIcon(false)
                                        }
                                    }}
                                />
                            </label>
                        )}
                        {uploadIconError && <p className="text-[10px] text-red-500">{uploadIconError}</p>}
                        <p className="text-[10.5px] text-editor-ink-dim leading-relaxed">
                            Shown in place of a preset arrow — everything else about this hotspot (size, rotation, and its click action below) works the same as any other type.
                        </p>
                    </div>
                )}

                {isLandmarkForm && (
                    <label className="flex items-center gap-1.5 text-[11px] text-editor-ink cursor-pointer">
                        <input
                            type="checkbox"
                            checked={state.animate_line !== false}
                            onChange={e => onUpdate({ ...state, animate_line: e.target.checked })}
                            className="w-3.5 h-3.5 accent-editor-primary"
                        />
                        Animate the line in when it comes into view
                    </label>
                )}

                {isLandmarkForm && (
                    <div className="space-y-1">
                        <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Stick color</label>
                        <div className="flex gap-1.5">
                            {HOTSPOT_COLORS.map(c => (
                                <button key={c} type="button" onClick={() => onUpdate({ ...state, color: c })}
                                        aria-label={c}
                                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                                            (state.color || HOTSPOT_COLORS[0]) === c ? 'border-editor-ink scale-110' : 'border-white/60 hover:scale-105'
                                        }`}
                                        style={{ background: c, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}/>
                            ))}
                        </div>
                    </div>
                )}
                {isLandmarkForm && (
                    <div className="space-y-1">
                        <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Label color</label>
                        <div className="flex gap-1.5">
                            {LABEL_COLORS.map(c => (
                                <button key={c} type="button" onClick={() => onUpdate({ ...state, label_color: c })}
                                        aria-label={c}
                                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                                            (state.label_color || LABEL_COLORS[0]) === c ? 'border-editor-ink scale-110' : 'border-white/60 hover:scale-105'
                                        }`}
                                        style={{ background: c, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}/>
                            ))}
                        </div>
                    </div>
                )}
                {showAxisSliders && (
                    <div className="space-y-2">
                        {/* Colors match the on-canvas 3-ring gizmo (middle.jsx's
                            startAxisRotate/isFloor preview block) — red/green/blue,
                            the universal X/Y/Z convention, so the ring you drag and
                            the slider it moves read as the same control. */}
                        {[
                            { key: 'rotate_x', label: 'Rotate X', value: state.rotate_x ?? 90, color: '#ef4444' },
                            { key: 'rotate_y', label: 'Rotate Y', value: state.rotate_y ?? 0, color: '#22c55e' },
                            { key: 'rotation',  label: 'Rotate Z', value: state.rotation ?? 0, color: '#3b82f6' },
                        ].map(({ key, label, value, color }) => (
                            <div key={key} className="space-y-0.5">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-1.5 text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }}/>
                                        {label}
                                    </label>
                                    <span className="text-[10px] text-editor-ink-muted font-mono">{Math.round(value)}°</span>
                                </div>
                                <input type="range" min="-180" max="180" step="1" value={value}
                                       onChange={e => onUpdate({ ...state, [key]: Number(e.target.value) })}
                                       className="w-full" style={{ accentColor: color }}/>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* A freshly-dropped, not-yet-saved hotspot has nothing to
                delete yet — Cancel (the header's back arrow) already covers
                "never mind, don't place it". Pushed to the very bottom, same
                distance-from-the-inputs reasoning as the zone form's own
                Delete button (polygon_panel.jsx). */}
            {state.mode === 'edit-existing' && (
                <div className="mt-auto px-3 py-3 border-t border-editor-border shrink-0">
                    <button onClick={onDelete} disabled={deleting}
                            className="w-full h-8 text-[11px] rounded-lg border border-editor-border text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                        {deleting ? <><Spinner/>Deleting…</> : 'Delete hotspot'}
                    </button>
                </div>
            )}
        </div>
    )
}

export default function HotspotPanel({
                                         scenes,
                                         activeSceneId,
                                         hotspots,
                                         onDeleteHotspot,
                                         popupState,
                                         onUpdatePopup,
                                         onSavePopup,
                                         onCancelPopup,
                                         onSelectHotspot,
                                         onUploadImage,
                                         savingHotspot,
                                         deletingHotspot,
                                         formRef,
                                     }) {
    const sceneHotspots = hotspots.filter(h => h.scene_id === activeSceneId)

    if (popupState?.mode === 'new' || popupState?.mode === 'edit-existing') {
        return (
            <HotspotForm
                state={popupState}
                scenes={scenes}
                activeSceneId={activeSceneId}
                hotspots={hotspots}
                onUpdate={onUpdatePopup}
                onSave={onSavePopup}
                onCancel={onCancelPopup}
                onDelete={() => onDeleteHotspot(popupState.hotspot.id)}
                onUploadImage={onUploadImage}
                saving={savingHotspot}
                deleting={deletingHotspot}
                formRef={formRef}
            />
        )
    }

    return (
        // The whole panel scrolls as one unit now, rather than only the saved
        // list — this used to be flex-1 h-full with just the bottom list
        // scrollable, which meant that once the right column had to fit three
        // stacked panels (Hotspot/Overlay/Zones), a shorter browser window
        // could squeeze this panel's available height below what the palette
        // + slider need, and everything past the header got silently clipped
        // by the parent's overflow-hidden instead of becoming reachable via
        // scroll.
        <aside className="flex flex-col h-full overflow-y-auto bg-editor-panel border-l border-editor-border select-none">

            {/* ── Header ── */}
            <div className="px-4 py-3 border-b border-editor-border shrink-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-editor-ink-muted">Directions</p>
                <p className="text-[10px] text-editor-ink-muted mt-0.5">Drag an arrow onto the viewer</p>
            </div>

            {/* ── Arrow drag palette ── */}
            <div className="px-3 py-3 border-b border-editor-border shrink-0">
                <p className="text-[10px] uppercase tracking-widest text-editor-ink-muted mb-2">Drag to place</p>
                <div className="grid grid-cols-2 gap-1.5">
                    {ARROWS.map(arrow => (
                        <div
                            key={arrow.type}
                            draggable
                            onDragStart={e => e.dataTransfer.setData('hotspot-type', arrow.type)}
                            className="flex flex-col items-center gap-1 p-1.5 rounded-lg border border-editor-border hover:border-editor-primary/40 hover:bg-editor-primary/5 cursor-grab active:cursor-grabbing transition-colors group"
                            title={arrow.label}
                        >
                            <img src={arrow.gif} alt={arrow.label} className="w-8 h-8 object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)]" draggable={false}/>
                            <span className="text-[9px] text-editor-ink-muted group-hover:text-editor-primary">{arrow.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Hotspot size is now per-arrow, set by dragging its resize
                handle on the canvas — the old tour-wide slider that used to
                live here is gone; an arrow with no individual size still
                falls back to the project's saved default under the hood. */}

            {/* Logo sizing moved to OverlayPanel — a project can carry several
                logos now, plus scene-level cover-ups, so one shared slider here
                no longer had anything unambiguous to control. */}

            {/* ── Saved hotspots list ── */}
            <div className="px-2 py-2 space-y-1">
                {sceneHotspots.length === 0 && (
                    <p className="text-[11px] text-editor-ink-muted text-center mt-6 px-2 leading-relaxed">
                        No directions yet.<br/>Drag an arrow onto the viewer.
                    </p>
                )}
                {sceneHotspots.map(h => {
                    const target = scenes.find(s => s.id === h.target_scene_id)
                    const arrow  = ARROWS.find(a => a.type === h.arrow_type)
                    return (
                        <div key={h.id}
                             onClick={() => onSelectHotspot(h.id)}
                             className="group flex items-center gap-2 px-2 py-2 rounded-lg border border-editor-border hover:border-editor-primary/30 hover:bg-editor-canvas transition-colors cursor-pointer">
                            <img src={arrow?.gif} alt={arrow?.label} className="w-6 h-6 object-contain shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"/>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold text-editor-ink truncate">{h.label || 'Untitled'}</p>
                                <p className="text-[10px] text-editor-ink-muted truncate">
                                    {h.target_scene_id ? `→ ${target?.name || 'Unknown'}` : 'No link set'}
                                </p>
                            </div>
                            <button
                                onClick={e => { e.stopPropagation(); onDeleteHotspot(h.id) }}
                                aria-label="Delete hotspot"
                                className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-editor-ink-muted hover:text-red-500 transition-all shrink-0"
                            >
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <path d="M18 6L6 18M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                    )
                })}
            </div>
        </aside>
    )
}
