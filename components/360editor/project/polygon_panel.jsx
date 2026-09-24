'use client'
// components/360editor/project/polygon_panel.jsx
//
// RIGHT PANEL — a LIST of zones (mirrors overlay_panel.jsx: each zone is one
// row, a color swatch instead of a thumbnail since a polygon has no image of
// its own), OR — while a zone is selected — that zone's form in place of the
// list. Clicking a zone (row or marker) always lands straight in the
// editable form, no separate read-only "view" step; there's no Save/Finish
// button either — every edit auto-saves a moment after you stop typing/
// dragging (see middle.jsx's debounced updatePolygon effect). The form used
// to float next to the shape's centroid on the canvas, independent of
// whichever right-panel tab happened to be active; it lives here now
// instead (same move as the hotspot form, see hotspot_panel.jsx), and
// middle.jsx flushes+closes it (rather than blocking) when you switch tabs
// or select something else.
import { useState } from 'react'
import { STATUS_COLORS, DEFAULT_STATUS_COLOR, colorForStatus, MAX_DETAIL_KEYS, DEFAULT_FILL_OPACITY, DEFAULT_HOVER_OPACITY, MAX_Z_INDEX } from '@/lib/polygons'
import InfoFieldsEditor from './info_fields_editor'
import ReferencePlanPanel from './reference_plan_panel'
import ColorPickerRow from './color_picker_row'

function Spinner({ size = 10 }) {
    return (
        <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24"
             fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
    )
}

const STATUS_OPTIONS = Object.keys(STATUS_COLORS)

function StatusSwatch({ status, customColor }) {
    return <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorForStatus(status, customColor) }}/>
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

// ─── PolygonForm ────────────────────────────────────────────────────────────
// Points are set by dragging corner handles on the canvas (middle.jsx) —
// every change here (label/status/detail/on-click fields) and every corner
// drag auto-saves on its own, a couple hundred ms after things go quiet (see
// middle.jsx's debounced updatePolygon effect); there's no Save/Finish
// button to click, and no separate read-only "view" step before you can
// edit — clicking a zone (row or marker) always lands you straight here.
//
// "On click" is the exact same action system hotspots have (see
// hotspot_panel.jsx's HotspotForm) — action_type/link_url/info_fields/
// info_image_url/toggle_target_id/start_hidden, same 5 action types
// (navigate/link/image/info/toggle), same fields, same shared
// InfoFieldsEditor for the 'info' card's content. Status/label/detail stay
// independent of it: they're the zone's own properties (status still
// drives the shape's fill color) shown whenever action_type is 'info', not
// the click-action selector itself.
function PolygonForm({ state, scenes, activeSceneId, hotspots, onUpdate, onDelete, onCancel, onSaveNow, onUploadImage, saving, justSaved, deleting }) {
    const [uploadingImage, setUploadingImage] = useState(false)
    const [uploadError, setUploadError] = useState('')
    const actionType = state.action_type || 'info'

    return (
        <div className="flex flex-col h-full overflow-y-auto bg-editor-panel border-l border-editor-border select-none">
            {/* ── Header ── */}
            {/* Same back-left/Save-right layout as the hotspot form's header
                (hotspot_panel.jsx). Editing here still auto-saves as you go
                (corner drags, status picks, typing) — Save is an explicit
                "I'm done" affordance that flushes anything still pending and
                returns to the list right away, rather than waiting on the
                debounce; Back does the same flush-then-close silently. */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-editor-border shrink-0 bg-editor-primary/6">
                <button onClick={onCancel} aria-label="Back"
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-editor-ink-muted hover:text-editor-ink hover:bg-editor-subtle transition-colors shrink-0">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <StatusSwatch status={state.status} customColor={state.custom_color}/>
                <span className="text-[11px] font-bold text-editor-primary flex-1 truncate">{state.label || 'Zone'}</span>
                <button onClick={onSaveNow} disabled={saving}
                        className="h-7 px-3 shrink-0 text-[11px] rounded-lg bg-editor-primary text-white
                                   font-semibold hover:bg-editor-primary-hover disabled:opacity-40
                                   transition-colors flex items-center justify-center gap-1">
                    {saving ? <><Spinner/>Saving…</> : justSaved ? (
                        <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>Saved</>
                    ) : 'Save'}
                </button>
            </div>

            <div className="px-3 py-3 space-y-2.5">
                <p className="text-[10.5px] text-editor-ink-muted leading-snug -mt-1">
                    Drag any corner on the canvas to reshape the zone.
                </p>
                <div className="space-y-1">
                    <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Label</label>
                    <input autoFocus value={state.label}
                           onChange={e => onUpdate({ ...state, label: e.target.value })}
                           placeholder="e.g. Unit 4B"
                           className="w-full h-7 bg-editor-surface border border-editor-border rounded-lg px-2.5 text-[12px] text-editor-ink focus:outline-none focus:border-editor-primary placeholder:text-editor-ink-muted"/>
                    {/* The label doubles as the plot-number badge drawn at
                        the zone's centre on the panorama — off hides just
                        the badge, the label itself still shows in the card
                        on click and in this panel's list. */}
                    <label className="flex items-center gap-1.5 text-[11px] text-editor-ink cursor-pointer pt-0.5">
                        <input type="checkbox"
                               checked={state.show_label !== false}
                               onChange={e => onUpdate({ ...state, show_label: e.target.checked })}
                               className="w-3.5 h-3.5 accent-editor-primary"/>
                        Show this label on the map
                    </label>
                    {/* Background color of the badge itself — independent of
                        the zone's own fill/border/hover colors above, same
                        picker. "Default" (the neutral light pill every badge
                        already used) clears the override. */}
                    <div className="space-y-1 pt-0.5">
                        <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Label color</label>
                        <ColorPickerRow
                            value={state.label_color || null}
                            onPick={c => onUpdate({ ...state, label_color: c })}
                            defaultLabel="Default"
                            defaultColor="#ffffff"
                            onClearDefault={() => onUpdate({ ...state, label_color: null })}
                        />
                    </div>
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
                    {/* Fill color — an override on top of whichever status
                        this zone has, preset or custom alike. "Default" (the
                        status's own fixed color, or the shared default for a
                        custom status) clears the override; any preset
                        swatch or the color wheel sets custom_color. */}
                    <div className="space-y-1 pt-0.5">
                        <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Fill color</label>
                        <ColorPickerRow
                            value={state.custom_color || null}
                            onPick={c => onUpdate({ ...state, custom_color: c })}
                            defaultLabel="Default"
                            defaultColor={STATUS_COLORS[state.status] || DEFAULT_STATUS_COLOR}
                            onClearDefault={() => onUpdate({ ...state, custom_color: null })}
                        />
                    </div>
                    {/* Border color — independent of fill, applies to every
                        zone regardless of status. "Same as fill" (the
                        default) clears the override; any other swatch or
                        the color wheel sets border_color, which the shape's
                        stroke then uses instead of the resolved fill color. */}
                    <div className="space-y-1 pt-0.5">
                        <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Border color</label>
                        <ColorPickerRow
                            value={state.border_color || null}
                            onPick={c => onUpdate({ ...state, border_color: c })}
                            defaultLabel="Same as fill"
                            defaultColor={colorForStatus(state.status, state.custom_color)}
                            onClearDefault={() => onUpdate({ ...state, border_color: null })}
                        />
                    </div>
                    {/* Hover fill color — what the zone turns while the
                        pointer is over it. "Same as fill" (the default)
                        clears the override, which is what hovering did
                        before it was configurable. Desktop only; there's
                        no hover state on a touchscreen. */}
                    <div className="space-y-1 pt-0.5">
                        <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Hover color</label>
                        <ColorPickerRow
                            value={state.hover_color || null}
                            onPick={c => onUpdate({ ...state, hover_color: c })}
                            defaultLabel="Same as fill"
                            defaultColor={colorForStatus(state.status, state.custom_color)}
                            onClearDefault={() => onUpdate({ ...state, hover_color: null })}
                        />
                    </div>
                    {/* Applies to the fill regardless of whether the color
                        above came from a preset status or a custom one —
                        it's a property of the zone's shading, not of the
                        color itself. Slider AND a typed number, kept in
                        sync — a drag is fine for "roughly this translucent",
                        but matching an exact value across several zones
                        needs to type the same number, not eyeball a slider. */}
                    <div className="space-y-1 pt-0.5">
                        <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Fill opacity</label>
                        <div className="flex items-center gap-2">
                            <input type="range" min={0} max={100} step={1}
                                   value={Math.round((state.fill_opacity ?? DEFAULT_FILL_OPACITY) * 100)}
                                   onChange={e => onUpdate({ ...state, fill_opacity: Number(e.target.value) / 100 })}
                                   className="flex-1 accent-editor-primary h-1 cursor-pointer"/>
                            <div className="flex items-center gap-1 shrink-0">
                                <input type="number" min={0} max={100} step={1}
                                       value={Math.round((state.fill_opacity ?? DEFAULT_FILL_OPACITY) * 100)}
                                       onChange={e => {
                                           const n = Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0)))
                                           onUpdate({ ...state, fill_opacity: n / 100 })
                                       }}
                                       className="w-11 h-6 bg-editor-surface border border-editor-border rounded-md px-1 text-[11px] text-editor-ink text-right font-mono tabular-nums focus:outline-none focus:border-editor-primary"/>
                                <span className="text-[10px] text-editor-ink-dim">%</span>
                            </div>
                        </div>
                    </div>
                    {/* Opacity while hovered. An absolute value, NOT a bump on
                        top of the fill opacity above — so e.g. fill 0 with
                        hover 60% gives a zone that's invisible until pointed
                        at, which a relative bump couldn't express. */}
                    <div className="space-y-1 pt-0.5">
                        <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Hover opacity</label>
                        <div className="flex items-center gap-2">
                            <input type="range" min={0} max={100} step={1}
                                   value={Math.round((state.hover_opacity ?? DEFAULT_HOVER_OPACITY) * 100)}
                                   onChange={e => onUpdate({ ...state, hover_opacity: Number(e.target.value) / 100 })}
                                   className="flex-1 accent-editor-primary h-1 cursor-pointer"/>
                            <div className="flex items-center gap-1 shrink-0">
                                <input type="number" min={0} max={100} step={1}
                                       value={Math.round((state.hover_opacity ?? DEFAULT_HOVER_OPACITY) * 100)}
                                       onChange={e => {
                                           const n = Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0)))
                                           onUpdate({ ...state, hover_opacity: n / 100 })
                                       }}
                                       className="w-11 h-6 bg-editor-surface border border-editor-border rounded-md px-1 text-[11px] text-editor-ink text-right font-mono tabular-nums focus:outline-none focus:border-editor-primary"/>
                                <span className="text-[10px] text-editor-ink-dim">%</span>
                            </div>
                        </div>
                    </div>
                    {/* Paint order for zones that overlap each other — a road
                        or common-area strip crossing a row of plots needs to
                        sit UNDER them, which is otherwise impossible (zones
                        paint in whatever order they load in). Lower goes
                        behind; the two buttons cover the whole real use case,
                        with the number there for finer stacking. */}
                    <div className="space-y-1 pt-0.5">
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
                </div>

                {/* Plot dimensions — one free-text length per edge (edge i runs
                    from corner i to corner i+1), typed in by hand. Zones live in
                    angular sphere coordinates with no real-world scale to
                    calibrate against, so this is a label you set deliberately,
                    not a measurement the app computes. Shown on the canvas too,
                    at each edge's midpoint, while this zone is selected. */}
                <div className="space-y-1">
                    <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Plot dimensions</label>
                    <div className="space-y-1">
                        {state.points.map((_, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                                <span className="w-11 shrink-0 text-[10.5px] text-editor-ink-dim">Side {i + 1}</span>
                                <input
                                    value={state.edge_lengths?.[i] || ''}
                                    onChange={e => {
                                        const next = state.points.map((__, j) => state.edge_lengths?.[j] || '')
                                        next[i] = e.target.value
                                        onUpdate({ ...state, edge_lengths: next })
                                    }}
                                    placeholder="e.g. 12 ft"
                                    className="flex-1 h-7 bg-editor-surface border border-editor-border rounded-lg px-2.5 text-[11px] text-editor-ink focus:outline-none focus:border-editor-primary placeholder:text-editor-ink-dim"/>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">On click</label>
                    <select
                        value={actionType}
                        onChange={e => onUpdate({ ...state, action_type: e.target.value })}
                        className="w-full h-7 bg-editor-surface border border-editor-border rounded-lg px-2
                                   text-[12px] text-editor-ink focus:outline-none focus:border-editor-primary"
                    >
                        <option value="info">Show status &amp; details</option>
                        <option value="navigate">Go to scene</option>
                        <option value="link">Open link</option>
                        <option value="image">Open image</option>
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
                                .filter(h => h.scene_id === activeSceneId)
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

                <DetailFields detail={state.detail} onChange={detail => onUpdate({ ...state, detail })}/>
            </div>

            {/* Pushed to the very bottom (mt-auto), not sitting right under
                the form fields — a destructive action reads as safer with
                real distance from the inputs you're actively typing into. */}
            <div className="mt-auto px-3 py-3 border-t border-editor-border shrink-0">
                <button onClick={onDelete} disabled={deleting}
                        className="w-full h-8 text-[11px] rounded-lg border border-editor-border text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                    {deleting ? <><Spinner/>Deleting…</> : 'Delete zone'}
                </button>
            </div>
        </div>
    )
}

function Row({ item, selected, onSelect, onDelete }) {
    return (
        <div
            onClick={() => onSelect(item.id)}
            className={`group flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                selected ? 'border-editor-primary bg-editor-primary/[0.04]' : 'border-editor-border bg-white hover:border-editor-primary/40'
            }`}
        >
            <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: colorForStatus(item.status, item.custom_color) }}/>
            <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-editor-ink leading-tight truncate">
                    {item.label || 'Untitled zone'}
                </div>
                <div className="text-[10px] text-editor-ink-dim leading-tight mt-0.5 capitalize">
                    {item.status}
                </div>
            </div>
            <svg className="opacity-0 group-hover:opacity-100 transition-opacity text-editor-icon-idle shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            <button
                onClick={e => { e.stopPropagation(); onDelete(item.id) }}
                title="Delete zone"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-editor-icon-idle hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
        </div>
    )
}

export default function PolygonPanel({
                                          polygons, selectedId, activeSceneId, drawing, onStartDraw, onSelect, onDelete,
                                          scenes, hotspots,
                                          polygonPopup, onUpdatePopup, onDeletePopup, onCancelPopup, onSaveNowPopup, onUploadImage,
                                          savingPolygon, justSavedPolygon, deletingPolygon,
                                          referencePlan,
                                      }) {
    if (polygonPopup) {
        return (
            <PolygonForm
                state={polygonPopup}
                scenes={scenes}
                activeSceneId={activeSceneId}
                hotspots={hotspots}
                onUpdate={onUpdatePopup}
                onDelete={onDeletePopup}
                onCancel={onCancelPopup}
                onSaveNow={onSaveNowPopup}
                onUploadImage={onUploadImage}
                saving={savingPolygon}
                justSaved={justSavedPolygon}
                deleting={deletingPolygon}
            />
        )
    }

    return (
        <div className="flex flex-col h-full bg-editor-panel border-l border-editor-border overflow-hidden">

            <div className="px-3 py-3 shrink-0">
                <div className="text-[11px] font-bold uppercase tracking-widest text-editor-ink-muted">Zones</div>
                <p className="text-[10px] text-editor-ink-dim mt-0.5">Draw a shape, then set its status.</p>
            </div>

            {/* A calibrated DXF to trace over — editor-only, deleted once the
                zones are drawn. Lives here rather than under Overlays because
                this is the panel you're already in while drawing zones. */}
            {referencePlan && <ReferencePlanPanel {...referencePlan}/>}

            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
                {polygons.length === 0 && !drawing && (
                    <p className="text-[11px] text-editor-ink-muted text-center mt-6 px-2 leading-relaxed">
                        No zones in this scene yet.
                    </p>
                )}
                {polygons.map(p => (
                    <Row key={p.id} item={p} selected={p.id === selectedId} onSelect={onSelect} onDelete={onDelete}/>
                ))}
            </div>

            <div className="shrink-0 border-t border-editor-border bg-white px-3 py-2.5">
                <button
                    onClick={onStartDraw}
                    disabled={!activeSceneId || drawing}
                    className={`w-full h-9 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                        drawing
                            ? 'bg-editor-subtle text-editor-ink-dim cursor-not-allowed'
                            : 'bg-editor-primary text-white hover:bg-editor-primary-hover disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                >
                    {drawing ? 'Click points on the viewer…' : (
                        <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                            Draw zone
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
