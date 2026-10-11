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
import { HOTSPOT_COLORS, LABEL_COLORS, DEFAULT_HOTSPOT_COLOR, MAX_Z_INDEX, HOTSPOT_SIZE_MIN, maxSizeFor } from '@/lib/hotspots'
import InfoFieldsEditor from './info_fields_editor'
import ColorPickerRow from './color_picker_row'
import PlanCropModal from './plan_crop_modal'
import { plotNumberLabels, visiblePlotNumbers } from '@/lib/plan-faces'
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
function HotspotForm({ state, scenes, activeSceneId, hotspots, onUpdate, onSave, onCancel, onDelete, onUploadImage, saving, deleting, formRef, defaultSize, anchorPicking, onToggleAnchorPick, snapping, onToggleSnap, onMakeZone, zonePicking, onToggleZonePick, onMakeAllPlots }) {
    const [zoneBusy, setZoneBusy] = useState(false)
    const [zoneMsg, setZoneMsg] = useState(null)   // { ok, message }
    // Only plot numbers inside the (possibly cropped) visible plan count —
    // the same rule the editor applies when making the zones.
    // (Includes numbers carried over from a numbered duplicate of the layout
    // when the crop shows an unnumbered copy — see visiblePlotNumbers.)
    const allPlotNumbers = plotNumberLabels(state.plan_shapes?.labels)
    const visibleNumbers = state.plan_shapes && allPlotNumbers.length ? visiblePlotNumbers(state.plan_shapes) : { labels: [], borrowed: false }
    const plotCount = visibleNumbers.labels.length
    const numbersOutsideCrop = allPlotNumbers.length > 0 && plotCount === 0

    // For a plan imported before plot numbers were kept: re-reads the same
    // DXF for its text labels only, leaving the drawing and its alignment
    // untouched. Checked against the plan's own extent, so picking a
    // different drawing by mistake is caught rather than mislabelling plots.
    async function importPlotNumbers(file) {
        try {
            const { dxfTextToLabels } = await import('@/lib/dxf')
            const labels = dxfTextToLabels(await file.text())
            const b = state.plan_shapes.originalBbox || state.plan_shapes.bbox
            const inside = labels.filter(l => l.x >= b.minX && l.x <= b.maxX && l.y >= b.minY && l.y <= b.maxY)
            if (!plotNumberLabels(inside).length) return { ok: false, message: 'No plot numbers found in that file for this plan — is it the same drawing?' }
            if (inside.length < labels.length * 0.5) return { ok: false, message: 'That file does not line up with this plan — pick the DXF it was imported from.' }
            onUpdate({ ...state, plan_shapes: { ...state.plan_shapes, labels: inside } })
            return { ok: true, message: `Found ${plotNumberLabels(inside).length} plot numbers. Save the hotspot to keep them.` }
        } catch (e) {
            return { ok: false, message: e?.message || 'Could not read that DXF.' }
        }
    }
    const sizeMax = maxSizeFor(state.arrow_type)
    const sizeValue = Math.round(state.size ?? defaultSize)
    const setSize = v => {
        const n = Number(v)
        if (!Number.isFinite(n)) return
        onUpdate({ ...state, size: Math.min(sizeMax, Math.max(HOTSPOT_SIZE_MIN, Math.round(n))) })
    }
    const [uploadingImage, setUploadingImage] = useState(false)
    const [uploadError, setUploadError] = useState('')

    const [uploadingIcon, setUploadingIcon] = useState(false)
    const [uploadIconError, setUploadIconError] = useState('')
    const [cropping, setCropping] = useState(false)

    const isLandmarkForm = state.arrow_type === 'landmark'
    const isCustomForm = state.arrow_type === 'custom'
    const isTextForm = state.arrow_type === 'text'
    const isPlanForm = state.arrow_type === 'siteplan'
    const isFlatPlan = isPlanForm && state.plan_shapes?.flat !== false
    const wrap180 = n => ((n + 180) % 360 + 360) % 360 - 180
    const heading = Math.round(wrap180((state.rotate_y ?? 0) + (state.rotation ?? 0)) * 100) / 100
    // Shown as the direction on the ground (heading + yaw), which dragging
    // and anchor pivots leave unchanged — the stored heading is measured
    // from the plan's centre direction, so it shifts whenever that moves.
    const groundHeading = Math.round(wrap180(heading + (state.yaw ?? 0)) * 10) / 10
    // 'floor', 'text' and 'siteplan' (all real 3D-embedded imageLayer
    // planes) and 'pulse' (a plain animated billboard) all get the same
    // Rotate X/Y/Z sliders, matching the same 3-ring gizmo shown for all
    // four on-canvas (middle.jsx) — X/Y are cosmetically inert for pulse (a
    // flat billboard can't tilt), same "present but harmless" precedent as
    // landmark's own unused rotation.
    const showAxisSliders = state.arrow_type === 'floor' || state.arrow_type === 'pulse' || isTextForm || isPlanForm
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

                <div className="space-y-1">
                    <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Size</label>
                    <div className="flex items-center gap-2">
                        <input type="range" min={HOTSPOT_SIZE_MIN} max={sizeMax} step={1} value={sizeValue}
                               onChange={e => setSize(e.target.value)}
                               className="flex-1 accent-editor-primary h-1 cursor-pointer"/>
                        <input key={sizeValue} type="number" min={HOTSPOT_SIZE_MIN} max={sizeMax} step={1} defaultValue={sizeValue}
                               onBlur={e => setSize(e.target.value)}
                               onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); setSize(e.currentTarget.value) } }}
                               className="w-16 h-6 shrink-0 bg-editor-surface border border-editor-border rounded-md px-1 text-[11px] text-editor-ink text-right font-mono tabular-nums focus:outline-none focus:border-editor-primary"/>
                    </div>
                </div>

                {isPlanForm && state.plan_shapes && (
                    <div className="space-y-1">
                        <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Plan area</label>
                        <button type="button" onClick={() => setCropping(true)}
                                className="w-full h-7 rounded-lg border border-editor-border text-[11px] font-semibold text-editor-ink hover:border-editor-primary/40 hover:bg-editor-primary/5 transition-colors flex items-center justify-center gap-1.5">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/></svg>
                            Crop plan
                        </button>
                        <div className="flex items-center gap-2 pt-1.5">
                            <span className="w-14 shrink-0 text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Opacity</span>
                            <input type="range" min={5} max={100} step={1}
                                   value={Math.round((state.plan_shapes.opacity ?? 1) * 100)}
                                   onChange={e => onUpdate({ ...state, plan_shapes: { ...state.plan_shapes, opacity: Number(e.target.value) / 100 } })}
                                   className="flex-1 accent-editor-primary h-1 cursor-pointer"/>
                            <span className="w-9 shrink-0 text-right text-[10px] font-mono tabular-nums text-editor-ink">{Math.round((state.plan_shapes.opacity ?? 1) * 100)}%</span>
                        </div>
                        {cropping && (
                            <PlanCropModal
                                planShapes={state.plan_shapes}
                                color={state.color || DEFAULT_HOTSPOT_COLOR}
                                onClose={() => setCropping(false)}
                                onApply={bbox => {
                                    onUpdate({ ...state, plan_shapes: { ...state.plan_shapes, bbox, originalBbox: state.plan_shapes.originalBbox || state.plan_shapes.bbox } })
                                    setCropping(false)
                                }}/>
                        )}
                    </div>
                )}

                {(isTextForm || isPlanForm) && (
                    <div className="space-y-1">
                        {/* Same picker (preset palette + color wheel) as a
                            zone's fill/border/hover color, using the SAME
                            default palette — one consistent color system
                            across zones and text, rather than the smaller
                            fixed swatch set every other hotspot color field
                            uses. For siteplan this tints the DXF line-drawing
                            itself (see planDecalImage), not a fill. */}
                        <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">{isPlanForm ? 'Line color' : 'Text color'}</label>
                        <ColorPickerRow
                            value={state.color || DEFAULT_HOTSPOT_COLOR}
                            onPick={c => onUpdate({ ...state, color: c })}
                        />
                    </div>
                )}

                {(isTextForm || isPlanForm) && (
                    <div className="space-y-1">
                        {/* Paint order among overlapping hotspots — same
                            Behind/Normal/In front pattern as a zone's own
                            Layer control (polygon_panel.jsx). */}
                        <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Layer</label>
                        <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => onUpdate({ ...state, z_index: -1 })}
                                    className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                                        (state.z_index ?? 0) < 0 ? 'border-editor-primary bg-editor-primary/8 text-editor-primary' : 'border-editor-border text-editor-ink-muted hover:border-editor-primary/40'
                                    }`}>
                                Behind
                            </button>
                            <button type="button" onClick={() => onUpdate({ ...state, z_index: 0 })}
                                    className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                                        (state.z_index ?? 0) === 0 ? 'border-editor-primary bg-editor-primary/8 text-editor-primary' : 'border-editor-border text-editor-ink-muted hover:border-editor-primary/40'
                                    }`}>
                                Normal
                            </button>
                            <button type="button" onClick={() => onUpdate({ ...state, z_index: 1 })}
                                    className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                                        (state.z_index ?? 0) > 0 ? 'border-editor-primary bg-editor-primary/8 text-editor-primary' : 'border-editor-border text-editor-ink-muted hover:border-editor-primary/40'
                                    }`}>
                                In front
                            </button>
                            <input type="number" min={-MAX_Z_INDEX} max={MAX_Z_INDEX} step={1}
                                   value={state.z_index ?? 0}
                                   onChange={e => {
                                       const n = Math.min(MAX_Z_INDEX, Math.max(-MAX_Z_INDEX, Math.round(Number(e.target.value) || 0)))
                                       onUpdate({ ...state, z_index: n })
                                   }}
                                   className="w-11 h-6 ml-auto shrink-0 bg-editor-surface border border-editor-border rounded-md px-1 text-[11px] text-editor-ink text-right font-mono tabular-nums focus:outline-none focus:border-editor-primary"/>
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
                {isPlanForm && state.plan_shapes && (
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={isFlatPlan}
                                   onChange={e => {
                                       const flat = e.target.checked
                                       // Turning it on folds the current Y and Z
                                       // into one heading, which is what a flat
                                       // plan renders with anyway.
                                       onUpdate(flat
                                           ? { ...state, plan_shapes: { ...state.plan_shapes, flat: true }, rotate_x: 90, rotate_y: 0, rotation: heading }
                                           : { ...state, plan_shapes: { ...state.plan_shapes, flat: false } })
                                   }}
                                   className="w-3.5 h-3.5 accent-editor-primary"/>
                            <span className="text-[11px] text-editor-ink">Lay flat on ground</span>
                        </label>
                        {isFlatPlan && (
                            <div className="space-y-1">
                                <button type="button" onClick={onToggleSnap}
                                        className={`w-full h-8 rounded-lg text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                                            snapping
                                                ? 'bg-amber-50 border border-amber-400 text-amber-700'
                                                : 'bg-editor-primary text-white hover:bg-editor-primary-hover'
                                        }`}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="5" cy="5" r="3"/><circle cx="19" cy="19" r="3"/><path d="M8 8l8 8" strokeDasharray="2 2"/></svg>
                                    {snapping ? 'Snapping… (Done on the canvas)' : 'Snap to points'}
                                </button>
                                <p className="text-[10.5px] text-editor-ink-dim leading-relaxed">
                                    Click a corner of the plan, then the same corner in the photo. Two pairs place it; more make it more accurate.
                                </p>
                                <button type="button" onClick={onToggleZonePick}
                                        className={`w-full h-7 rounded-lg text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                                            zonePicking
                                                ? 'bg-green-50 border border-green-500 text-green-700'
                                                : 'border border-editor-border text-editor-ink hover:border-editor-primary/40 hover:bg-editor-primary/5'
                                        }`}>
                                    {zonePicking ? 'Making zones… (Done on the canvas)' : 'Click plots to make zones'}
                                </button>
                                <button type="button" disabled={zoneBusy || !onMakeZone}
                                        onClick={async () => {
                                            setZoneBusy(true); setZoneMsg(null)
                                            try { setZoneMsg(await onMakeZone()) } finally { setZoneBusy(false) }
                                        }}
                                        className="w-full h-7 rounded-lg border border-editor-border text-[11px] font-semibold text-editor-ink hover:border-editor-primary/40 hover:bg-editor-primary/5 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                                    {zoneBusy ? <><Spinner/>Creating zone…</> : 'Zone from whole outline'}
                                </button>
                                {plotCount > 0 ? (
                                    <button type="button" disabled={zoneBusy || !onMakeAllPlots}
                                            onClick={async () => {
                                                setZoneBusy(true); setZoneMsg(null)
                                                try { setZoneMsg(await onMakeAllPlots()) } finally { setZoneBusy(false) }
                                            }}
                                            className="w-full h-7 rounded-lg bg-green-600 text-white text-[11px] font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                                        {zoneBusy ? <><Spinner/>Working…</> : `Make zones for all ${plotCount} plots`}
                                    </button>
                                ) : numbersOutsideCrop ? (
                                    <p className="text-[10.5px] leading-relaxed text-amber-700">
                                        This drawing's {allPlotNumbers.length} plot numbers are all outside your cropped area, so plots can't be named automatically. Crop to the numbered part of the drawing, or name zones by hand.
                                    </p>
                                ) : (
                                    <label className="w-full h-7 rounded-lg border border-dashed border-editor-primary/40 text-[11px] font-semibold text-editor-primary hover:bg-editor-primary/5 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                           title="Pick the same DXF this plan was imported from, to read its plot numbers">
                                        Import plot numbers from the DXF
                                        <input type="file" accept=".dxf" className="hidden"
                                               onChange={async e => {
                                                   const file = e.target.files?.[0]; e.target.value = ''
                                                   if (file) setZoneMsg(await importPlotNumbers(file))
                                               }}/>
                                    </label>
                                )}
                                {zoneMsg && (
                                    <p className={`text-[10.5px] leading-relaxed ${zoneMsg.ok ? 'text-green-700' : 'text-red-600'}`}>{zoneMsg.message}</p>
                                )}
                            </div>
                        )}
                        {isFlatPlan && (
                            <div className="space-y-0.5">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-1.5 text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#3b82f6' }}/>
                                        Heading
                                    </label>
                                    <span className="text-[10px] text-editor-ink-muted font-mono">{groundHeading}°</span>
                                </div>
                                <input type="range" min="-180" max="180" step="0.1" value={groundHeading}
                                       onChange={e => onUpdate({ ...state, rotate_x: 90, rotate_y: 0, rotation: wrap180(Number(e.target.value) - (state.yaw ?? 0)) })}
                                       className="w-full" style={{ accentColor: '#3b82f6' }}/>
                                <p className="text-[10.5px] text-editor-ink-dim leading-relaxed">
                                    Kept exactly level, so it lines up with the ground. Match it by moving, resizing and turning it.
                                </p>

                                {/* Fine corrections once one end lines up but the other
                                    drifts: tilt for a camera that isn't quite level,
                                    stretch for proportions that differ from the DXF. */}
                                <div className="pt-2 space-y-1">
                                    <span className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Anchor</span>
                                    <div className="flex items-center gap-1.5">
                                        <button type="button" onClick={onToggleAnchorPick}
                                                className={`flex-1 h-7 rounded-lg border text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                                                    anchorPicking
                                                        ? 'border-amber-400 bg-amber-50 text-amber-700'
                                                        : 'border-editor-border text-editor-ink hover:border-editor-primary/40 hover:bg-editor-primary/5'
                                                }`}>
                                            <svg width="12" height="12" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="13" cy="13" r="6"/><path d="M13 0v8M13 18v8M0 13h8M18 13h8"/></svg>
                                            {anchorPicking ? 'Click the plan…' : (state.plan_shapes.anchor ? 'Move anchor' : 'Set anchor')}
                                        </button>
                                        {state.plan_shapes.anchor && (
                                            <button type="button"
                                                    onClick={() => onUpdate({ ...state, plan_shapes: { ...state.plan_shapes, anchor: null } })}
                                                    className="h-7 px-2.5 rounded-lg border border-editor-border text-[11px] text-editor-ink-muted hover:bg-editor-subtle transition-colors">
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[10.5px] text-editor-ink-dim leading-relaxed">
                                        {state.plan_shapes.anchor
                                            ? 'Size, heading, tilt and stretch now pivot around the pin, so the spot you matched stays put.'
                                            : 'Pin a spot you have already matched; everything below then pivots around it.'}
                                    </p>
                                </div>
                                <div className="flex items-center justify-between pt-2">
                                    <span className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Fine-tune</span>
                                    <button type="button"
                                            onClick={() => onUpdate({ ...state, plan_shapes: { ...state.plan_shapes, tiltX: 0, tiltY: 0, stretchX: 1, stretchY: 1 } })}
                                            className="text-[10px] text-editor-primary hover:underline">Reset</button>
                                </div>
                                {[
                                    { key: 'tiltX',    label: 'Tilt ↕',    min: -5,  max: 5,   step: 0.05, dflt: 0, fmt: v => `${v.toFixed(2)}°` },
                                    { key: 'tiltY',    label: 'Tilt ↔',    min: -5,  max: 5,   step: 0.05, dflt: 0, fmt: v => `${v.toFixed(2)}°` },
                                    { key: 'stretchX', label: 'Stretch ↔', min: 0.8, max: 1.2, step: 0.001, dflt: 1, fmt: v => `${(v * 100).toFixed(1)}%` },
                                    { key: 'stretchY', label: 'Stretch ↕', min: 0.8, max: 1.2, step: 0.001, dflt: 1, fmt: v => `${(v * 100).toFixed(1)}%` },
                                ].map(({ key, label, min, max, step, dflt, fmt }) => {
                                    const v = Number(state.plan_shapes[key] ?? dflt)
                                    return (
                                        <div key={key} className="flex items-center gap-2">
                                            <span className="w-16 shrink-0 text-[10px] text-editor-ink-muted">{label}</span>
                                            <input type="range" min={min} max={max} step={step} value={v}
                                                   onChange={e => onUpdate({ ...state, plan_shapes: { ...state.plan_shapes, [key]: Number(e.target.value) } })}
                                                   className="flex-1 accent-editor-primary h-1 cursor-pointer"/>
                                            <span className="w-12 shrink-0 text-right text-[10px] font-mono tabular-nums text-editor-ink">{fmt(v)}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {showAxisSliders && !isFlatPlan && (
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
                                         defaultSize = 90,
                                         anchorPicking = false,
                                         onToggleAnchorPick,
                                         snapping = false,
                                         onToggleSnap,
                                         onMakeZone,
                                         onMakeAllPlots,
                                         zonePicking = false,
                                         onToggleZonePick,
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
                defaultSize={defaultSize}
                anchorPicking={anchorPicking}
                onToggleAnchorPick={onToggleAnchorPick}
                snapping={snapping}
                onToggleSnap={onToggleSnap}
                onMakeZone={onMakeZone}
                onMakeAllPlots={onMakeAllPlots}
                zonePicking={zonePicking}
                onToggleZonePick={onToggleZonePick}
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
