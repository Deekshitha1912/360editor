'use client'
import React, { useEffect, useRef, useState, useCallback, useReducer } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Viewer } from '@photo-sphere-viewer/core'
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin'
import '@photo-sphere-viewer/core/index.css'
import '@photo-sphere-viewer/markers-plugin/index.css'
import ScenePanel       from '@/components/360editor/project/scene_panel'
import HotspotPanel from '@/components/360editor/project/hotspot_panel'
import OverlayPanel from '@/components/360editor/project/overlay_panel'
import PolygonPanel from '@/components/360editor/project/polygon_panel'
import { ARROWS } from '@/lib/arrows'
import { newOverlayId, LOGO_DEFAULTS, COVERUP_DEFAULTS, projectLogos, projectCoverups, overlaysForScene } from '@/lib/overlays'
import { colorForStatus, centroidOf } from '@/lib/polygons'
import TourPreviewModal from '@/components/360editor/project/preview'
import { buildTourHtml } from '@/components/360editor/project/export'
import { HotspotPopup } from '@/components/360editor/project/hotspot_overlay'
import { PolygonPopup } from '@/components/360editor/project/polygon_overlay'
import { roundTo2, flagsInit, flagsReducer } from '@/components/360editor/project/editor_utils'
import { Spinner, CameraControls, SettingsModal, DeleteModal, HotspotDeleteModal } from '@/components/360editor/project/editor_modals'

// Radians <-> degrees. Hotspot/overlay data is stored in degrees everywhere
// (DB, API, React state) exactly as before the viewer swap — PSV's Position
// type is radians, so conversion happens only at the two dataHelper boundary
// calls (sampleAt, mainLoop) and nowhere else. Marker *configs* skip this
// entirely by using PSV's degree-suffixed string form ("12.3deg").
const RAD = Math.PI / 180
const DEG = 180 / Math.PI

// Overlay editing card — styled to match the hotspot popup (light card, indigo
// header, right-of-target with edge fallback), so overlays and hotspots feel
// like one system. Two modes:
//   confirm — "Edit this logo/cover-up?" with No / Yes, edit
//   edit    — scope switch + size/opacity(/rotate) sliders
function OverlayRow({ label, value, min, max, step = 1, suffix = '', onChange }) {
    return (
        <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-[9px] font-bold tracking-wider text-[#6b6b60] uppercase">{label}</span>
            <input type="range" min={min} max={max} step={step} value={value}
                   onChange={e => onChange(Number(e.target.value))}
                   onMouseDown={e => e.stopPropagation()}
                   className="flex-1 accent-[#3730a3] h-1 cursor-pointer"/>
            <span className="w-9 shrink-0 text-right text-[10px] font-mono tabular-nums text-[#1a1a18]">{value}{suffix}</span>
        </div>
    )
}
// screenPos = the overlay's {x,y} within the viewer (for edge decisions).
// The popup itself is rendered inside the overlay's wrapper, so its own left/top
// are offsets FROM the overlay, not absolute viewer coordinates.
function OverlayPopup({ item, kind, editing, screenPos, halfW, halfH, viewerSize, activeSceneId, activeSceneName,
                          onEdit, onPatch, onSetScope, onDelete, onClose }) {
    const isLogo     = kind === 'logo'
    const everyScene = item.scene_id == null
    const W = 224
    const H = editing ? (isLogo ? 190 : 214) : 120

    const sx = screenPos?.x ?? 0, sy = screenPos?.y ?? 0
    const vw = viewerSize?.w || 9999, vh = viewerSize?.h || 9999
    const hw = halfW || 20, hh = halfH || 20   // overlay half-size on screen
    const GAP = 16

    // Decide a side that CLEARS THE IMAGE (offset from the overlay's edge, not its
    // centre) and keeps the whole card in the viewer. Order: right, left, below,
    // above. Whatever is chosen, the card never overlaps the overlay.
    const roomRight = vw - (sx + hw) - 8
    const roomLeft  = (sx - hw) - 8
    const roomBelow = vh - (sy + hh) - 8
    const roomAbove = (sy - hh) - 8

    let offsetX, offsetY, side
    if (roomRight >= W + GAP)      { side = 'right'; offsetX = hw + GAP;        offsetY = -(H/2) }
    else if (roomLeft >= W + GAP)  { side = 'left';  offsetX = -(hw + GAP + W); offsetY = -(H/2) }
    else if (roomBelow >= H + GAP) { side = 'below'; offsetY = hh + GAP;        offsetX = -(W/2) }
    else                           { side = 'above'; offsetY = -(hh + GAP + H); offsetX = -(W/2) }

    // Clamp along the free axis so the card stays fully on screen.
    if (side === 'right' || side === 'left') {
        if (sy + offsetY < 8)          offsetY = 8 - sy
        if (sy + offsetY + H > vh - 8) offsetY = vh - 8 - H - sy
    } else {
        if (sx + offsetX < 8)          offsetX = 8 - sx
        if (sx + offsetX + W > vw - 8) offsetX = vw - 8 - W - sx
    }

    return (
        <div className="absolute z-40 pointer-events-auto"
             style={{ left: offsetX, top: offsetY, width: W }}
             onMouseDown={e => e.stopPropagation()}>

            <div className="bg-white/95 backdrop-blur-md rounded-xl border border-[#E2E2DA] shadow-[0_8px_32px_rgba(0,0,0,0.18)] overflow-hidden">

                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-[#3730a3]/6 border-b border-[#E2E2DA]">
                    <div className="w-5 h-5 rounded border border-[#E2E2DA] bg-white overflow-hidden flex items-center justify-center shrink-0">
                        <img src={item.url} alt="" className="max-w-full max-h-full object-contain"/>
                    </div>
                    <span className="text-[11px] font-bold text-[#3730a3] flex-1">
                        {editing ? `Edit ${isLogo ? 'logo' : 'cover-up'}` : `Edit ${isLogo ? 'logo' : 'cover-up'}?`}
                    </span>
                    <button onClick={onClose} className="text-[#9a9a8e] hover:text-[#1a1a18] transition-colors shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                </div>

                {/* Confirm */}
                {!editing && (
                    <div className="px-3 py-3 space-y-2.5">
                        <div>
                            <p className="text-[12px] font-semibold text-[#1a1a18]">
                                {isLogo ? 'Logo' : 'Cover-up'}
                            </p>
                            <p className="text-[11px] text-[#6b6b60] mt-0.5 flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${everyScene ? 'bg-emerald-400' : 'bg-[#3730a3]'}`}/>
                                {everyScene ? 'Every scene' : (item.scene_id === activeSceneId ? 'This scene' : 'Another scene')}
                            </p>
                        </div>
                        <p className="text-[11px] text-[#6b6b60]">Edit this {isLogo ? 'logo' : 'cover-up'}?</p>
                        <div className="flex gap-1.5">
                            <button onClick={onDelete}
                                    className="flex-1 h-7 text-[11px] rounded-lg border border-[#E2E2DA] text-red-500 hover:bg-red-50 transition-colors">
                                Delete
                            </button>
                            <button onClick={onEdit}
                                    className="flex-1 h-7 text-[11px] rounded-lg bg-[#3730a3] text-white font-semibold hover:bg-[#312e81] transition-colors">
                                Yes, edit
                            </button>
                        </div>
                    </div>
                )}

                {/* Edit */}
                {editing && (
                    <div className="px-3 py-3 space-y-2.5">
                        <div>
                            <p className="text-[10px] text-[#6b6b60] uppercase tracking-wider font-medium mb-1">Show in</p>
                            <div className="flex p-0.5 rounded-lg bg-[#F4F4EF] border border-[#E2E2DA]">
                                <button onClick={() => onSetScope(item.id, null)}
                                        className={`flex-1 h-6 rounded-md text-[10.5px] font-semibold transition-colors ${everyScene ? 'bg-white text-[#3730a3] shadow-sm' : 'text-[#9a9a8e] hover:text-[#6b6b60]'}`}>
                                    Every scene
                                </button>
                                <button onClick={() => activeSceneId && onSetScope(item.id, activeSceneId)} disabled={!activeSceneId}
                                        title={activeSceneName ? `Only ${activeSceneName}` : undefined}
                                        className={`flex-1 h-6 rounded-md text-[10.5px] font-semibold transition-colors disabled:opacity-40 ${!everyScene ? 'bg-white text-[#3730a3] shadow-sm' : 'text-[#9a9a8e] hover:text-[#6b6b60]'}`}>
                                    This scene
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <OverlayRow label="Size"    value={Math.round(item.size)}        min={24} max={isLogo ? 640 : 800} suffix=""  onChange={v => onPatch(item.id, { size: v })}/>
                            <OverlayRow label="Opacity" value={Math.round(item.opacity*100)} min={5}  max={100}                 suffix="%" onChange={v => onPatch(item.id, { opacity: v/100 })}/>
                            {!isLogo && (
                                <OverlayRow label="Rotate" value={Math.round(item.rotation)} min={-180} max={180} suffix="°" onChange={v => onPatch(item.id, { rotation: v })}/>
                            )}
                        </div>

                        <div className="flex gap-1.5">
                            <button onClick={onDelete}
                                    className="flex-1 h-7 text-[11px] rounded-lg border border-[#E2E2DA] text-red-500 hover:bg-red-50 transition-colors">
                                Delete
                            </button>
                            <button onClick={onClose}
                                    className="flex-1 h-7 text-[11px] rounded-lg bg-[#3730a3] text-white font-semibold hover:bg-[#312e81] transition-colors">
                                Done
                            </button>
                        </div>
                        <p className="text-[10px] text-[#9a9a8e] leading-snug">
                            {isLogo ? 'Drag it in the tour to place it — it stays fixed on screen.'
                                : 'Drag it onto what to hide — it sticks to the photo.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}


// ─── Main editor component ────────────────────────────────────────────────────

export default function ProjectClient({ projectId }) {
    const router           = useRouter()
    const viewerRef        = useRef(null)
    const psvRef           = useRef(null)   // Photo Sphere Viewer instance (was pannellumRef)
    const markersPluginRef = useRef(null)
    const viewerSceneIdRef = useRef(null)
    const rafRef           = useRef(null)
    const scenesRef        = useRef([])
    const popupRef         = useRef(null)
    const onHotspotClickRef = useRef(null)
    const onCoverupClickRef = useRef(null)
    const onPolygonClickRef = useRef(null)
    const lastVertexRef     = useRef(null)   // { yaw, pitch, t } — guards against a click double-firing
    const logoDragRef       = useRef(null)   // { offX, offY } in px while dragging a logo
    const [logoAspect, setLogoAspect] = useState({}) // logo id -> naturalHeight/naturalWidth
    const [coverupAspect, setCoverupAspect] = useState({}) // coverup id -> naturalHeight/naturalWidth
    const coverupsRef       = useRef([])     // full coverups list, read inside the rAF loop by id
    const selectedOverlayRef = useRef(null)  // mirrors selectedOverlay, read inside the rAF loop
    const polygonsRef        = useRef([])    // full polygons list, read inside the marker click/hover handlers
    const drawingPolygonRef  = useRef(null)  // mirrors drawingPolygon, read inside the PSV click handler
    const polygonPopupRef    = useRef(null)  // mirrors polygonPopup, read inside the rAF loop
    const previewOpenRef    = useRef(false)  // pause the rAF loop while the preview modal is open

    const [project, setProject]                 = useState(null)
    const [scenes, setScenes]                   = useState([])
    const [hotspots, setHotspots]               = useState([])
    const [activeScene, setActiveScene]         = useState(null)
    const [loading, setLoading]                 = useState(true)
    const [isDragOver, setIsDragOver]           = useState(false)
    const [isDraggingPin, setIsDraggingPin]     = useState(false)
    const [showSettings, setShowSettings]       = useState(false)
    const [settingsDraft, setSettingsDraft]     = useState(null)
    const [confirmDelete, setConfirmDelete]     = useState(false)
    const [pinPos, setPinPos]                   = useState(null)
    const [viewerSize, setViewerSize]           = useState({ w: 0, h: 0 })
    const [flags, dispatchFlag]                 = useReducer(flagsReducer, flagsInit)
    const [previewHtml, setPreviewHtml]         = useState(null)
    const [publicUrl, setPublicUrl]             = useState(null)   // live tour URL — null until published
    const [publishError, setPublishError]       = useState('')
    const [overlayError, setOverlayError]       = useState('')

    // Overlays are edited freely and written once, on Save. Dragging used to
    // PATCH on every drop, which meant a round trip mid-gesture — the pause you
    // could see as the image reloading. Nothing touches the database now until
    // the button is pressed.
    const [dirtyLogos, setDirtyLogos]           = useState(false)
    const [dirtyCoverups, setDirtyCoverups]     = useState(false)
    const [savingOverlays, setSavingOverlays]   = useState(false)
    const [savedTick, setSavedTick]             = useState(false)
    const pendingDeletesRef = useRef([])   // storage URLs to remove once the save lands
    const [copied, setCopied]                   = useState(false)

    // ── Overlays ───────────────────────────────────────────────────────────
    // logos    — screen-anchored, each scoped to one scene or all
    // coverups — sphere-anchored, each scoped to one scene or all
    // Both hold the FULL project list; the viewer shows only what belongs to the
    // active scene. Exactly one overlay is draggable at a time (the selected row).
    const [logos, setLogos]                     = useState([])
    const [coverups, setCoverups]               = useState([])
    const [selectedOverlay, setSelectedOverlay] = useState(null)
    const [editOverlay, setEditOverlay]         = useState(null)   // id in confirmed edit mode
    const [draggingOverlay, setDraggingOverlay] = useState(null)   // id being dragged
    const [coverupPopupScreen, setCoverupPopupScreen] = useState(null) // {x,y,hfov} of the SELECTED cover-up only, recomputed each frame

    const [hotspotSize, setHotspotSize]         = useState(90)
    const [hotspotToDelete, setHotspotToDelete] = useState(null)
    const [deletingHotspot, setDeletingHotspot] = useState(false)

    // ── Polygon zones ──────────────────────────────────────────────────────
    // Always scene-scoped (no "every scene" concept — a zone marks a specific
    // room). Points are immutable once drawn; the popup only edits
    // status/label/detail. drawingPolygon holds points while placing vertices
    // (click-to-place, same interaction as the validated spike); polygonPopup
    // is 'new' (just-finished draw, not yet saved) | 'view' (existing zone,
    // read-only card) | 'edit' (existing zone, metadata form).
    const [polygons, setPolygons]               = useState([])
    const [drawingPolygon, setDrawingPolygon]   = useState(null)
    const [polygonPopup, setPolygonPopup]       = useState(null)
    const [polygonPopupScreen, setPolygonPopupScreen] = useState(null)
    const [savingPolygon, setSavingPolygon]     = useState(false)
    const [deletingPolygon, setDeletingPolygon] = useState(false)
    const [polygonError, setPolygonError]       = useState('')

    // popupState modes: 'new' | 'confirm-edit' | 'edit-existing' | 'saved'
    const [popupState, setPopupState] = useState(null)

    scenesRef.current         = scenes
    popupRef.current          = popupState
    coverupsRef.current       = coverups
    selectedOverlayRef.current = selectedOverlay
    polygonsRef.current       = polygons
    drawingPolygonRef.current = drawingPolygon
    polygonPopupRef.current   = polygonPopup

    // What the ACTIVE scene displays: every-scene overlays + those scoped here.
    const visibleLogos    = overlaysForScene(logos,    activeScene?.id)
    const visibleCoverups = overlaysForScene(coverups, activeScene?.id)
    // Zones are always scene-scoped — no "every scene" concept.
    const visiblePolygons = polygons.filter(p => p.scene_id === activeScene?.id)

    // Id of the hotspot currently being edited (stable primitive for effect deps)
    const editingId = popupState?.mode === 'edit-existing' ? popupState.hotspot?.id : null

    // ── Fetch ──────────────────────────────────────────────────────────────
    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/projects/${projectId}`)
                if (res.status === 401) { router.push('/'); return }
                if (!res.ok)            { router.push('/360editor'); return }
                const data = await res.json()
                setProject(data.project)
                setLogos(projectLogos(data.project))
                setCoverups(projectCoverups(data.project))
                setPublicUrl(data.public_url ?? null)
                setScenes(data.scenes)
                setHotspots(data.hotspots)
                setPolygons(data.polygons ?? [])
                if (data.scenes.length > 0) setActiveScene(data.scenes[0])
            } catch {
                router.push('/360editor')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [projectId]) // eslint-disable-line

    // ── Sync hotspot size from project ─────────────────────────────────────
    useEffect(() => {
        if (!project) return
        setHotspotSize(project.hotspot_size ?? 90)
    }, [project?.hotspot_size]) // eslint-disable-line

    // ── Cover-ups follow the active scene ──────────────────────────────────
    // Switching rooms swaps the whole list, and drops any selection that
    // belonged to the scene you just left.
    // The cover-up is the same in every scene, so switching rooms only has to
    // let go of any drag in progress.
    useEffect(() => {
        setDraggingOverlay(null)
        setEditOverlay(null)
        // A zone belongs to a specific room — switching away mid-draw or
        // mid-view would be drawing/looking at the wrong scene's shape.
        setDrawingPolygon(null)
        setPolygonPopup(null)
    }, [activeScene?.id]) // eslint-disable-line

    // Closing the tab with unsaved overlays should cost a confirmation, not the work.
    useEffect(() => {
        if (!dirtyLogos && !dirtyCoverups) return
        const warn = e => { e.preventDefault(); e.returnValue = '' }
        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [dirtyLogos, dirtyCoverups])

    // ── Load natural aspect ratio for each cover-up ─────────────────────────
    // PSV image markers need an explicit {width,height} (unlike a plain <img>,
    // which can leave height:auto) — so the natural ratio has to be known up
    // front, the same way logoAspect already tracks it for logos.
    useEffect(() => {
        for (const c of coverups) {
            if (coverupAspect[c.id] != null) continue
            const img = new Image()
            img.onload = () => {
                const r = img.naturalHeight / (img.naturalWidth || 1)
                setCoverupAspect(prev => (prev[c.id] != null ? prev : { ...prev, [c.id]: r }))
            }
            img.src = c.url
        }
    }, [coverups]) // eslint-disable-line

    // ── Track viewer size (for popup edge-clamping) ────────────────────────
    useEffect(() => {
        const el = viewerRef.current
        if (!el) return
        const ro = new ResizeObserver(([e]) => {
            const { width, height } = e.contentRect
            setViewerSize({ w: width, h: height })
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [activeScene])

    // ── Marker click handlers (via stable refs so the PSV listener, registered
    // once per viewer instance, always calls the current closure) ──────────
    onHotspotClickRef.current = (hotspotId) => {
        const h = hotspots.find(x => x.id === hotspotId)
        if (!h) return
        setPopupState({ mode: 'confirm-edit', hotspot: h })
    }
    onCoverupClickRef.current = (coverupId) => {
        if (!coverupId) return
        setSelectedOverlay(coverupId)
        setEditOverlay(null)
    }
    onPolygonClickRef.current = (polygonId) => {
        const p = polygons.find(x => x.id === polygonId)
        if (!p) return
        setPolygonPopup({ mode: 'view', polygon: p })
    }

    // ── Viewer init ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!activeScene || !viewerRef.current) return
        if (viewerSceneIdRef.current === activeScene.id && psvRef.current) return

        psvRef.current?.destroy()
        psvRef.current           = null
        markersPluginRef.current = null
        viewerSceneIdRef.current = activeScene.id
        setPopupState(null)

        const viewer = new Viewer({
            container: viewerRef.current,
            panorama: activeScene.url,
            defaultYaw:   `${activeScene.initial_yaw   ?? 0}deg`,
            defaultPitch: `${activeScene.initial_pitch ?? -5}deg`,
            minFov: 30,
            maxFov: 130,
            navbar: false,
            plugins: [[MarkersPlugin, {}]],
        })

        // PSV's zoom axis (0-100) isn't the same as Pannellum's hfov degrees —
        // convert once the instance is ready so the opening view matches what
        // was saved.
        viewer.addEventListener('ready', () => {
            try { viewer.zoom(viewer.dataHelper.fovToZoomLevel(activeScene.initial_hfov ?? 120)) } catch {}
        }, { once: true })

        const mp = viewer.getPlugin(MarkersPlugin)
        mp.addEventListener('select-marker', ({ marker }) => {
            // Drawing a zone takes priority — a vertex click landing on an
            // existing arrow/cover-up/zone must place a point, not also open
            // that marker's own popup.
            if (drawingPolygonRef.current) return
            if (marker.id.startsWith('hs_'))        onHotspotClickRef.current?.(marker.data?.hotspotDbId)
            else if (marker.id.startsWith('cv_'))   onCoverupClickRef.current?.(marker.data?.coverupId)
            else if (marker.id.startsWith('poly_')) onPolygonClickRef.current?.(marker.data?.polygonId)
        })
        mp.addEventListener('enter-marker', ({ marker }) => {
            if (!marker.id.startsWith('poly_')) return
            const p = polygonsRef.current.find(x => x.id === marker.data?.polygonId)
            if (!p) return
            const c = colorForStatus(p.status)
            mp.updateMarker({ id: marker.id, svgStyle: { fill: c + '99', stroke: c, strokeWidth: '3' } })
        })
        mp.addEventListener('leave-marker', ({ marker }) => {
            if (!marker.id.startsWith('poly_')) return
            const p = polygonsRef.current.find(x => x.id === marker.data?.polygonId)
            if (!p) return
            const c = colorForStatus(p.status)
            mp.updateMarker({ id: marker.id, svgStyle: { fill: c + '55', stroke: c, strokeWidth: '2' } })
        })
        // Click-to-place-vertex while drawing a zone. A raw viewer click (not
        // a marker select), fired regardless of what's under the cursor.
        //
        // The shape auto-closes on its own (the last point connects straight
        // back to the first) — clicking the starting corner again is NOT
        // needed to close it, and doing so used to add a near-duplicate
        // vertex sitting almost on top of point 1, which barely shows in the
        // OPEN preview line but throws off which region the CLOSED filled
        // polygon fills once it auto-closes, producing a collapsed/twisted
        // shape. So: a click landing back near the first point FINISHES the
        // shape (using the points already placed) instead of adding one —
        // matching how most polygon tools treat "click back at the start".
        //
        // Also guarded against firing twice for what the user experiences as
        // one click (a tight time+distance check on the immediately-previous
        // point) — belt and suspenders against React Strict Mode's
        // double-invoked effects in dev possibly overlapping two Viewer
        // instances for a moment, each registering its own listener against
        // the same shared setDrawingPolygon.
        viewer.addEventListener('click', ({ data }) => {
            if (!drawingPolygonRef.current) return
            // Straight off the click event, same as the standalone spike that
            // validated this whole drawing flow — that comparison is what
            // proved the real bug was server-side (normalizePoints clamping
            // yaw instead of wrapping it, see lib/polygons.js), not here.
            const yaw   = data.yaw   * DEG
            const pitch = data.pitch * DEG

            const last = lastVertexRef.current
            const now  = Date.now()
            if (last && now - last.t < 250 && Math.abs(yaw - last.yaw) < 0.05 && Math.abs(pitch - last.pitch) < 0.05) {
                return
            }

            const pts = drawingPolygonRef.current.points
            if (pts.length >= 3) {
                try {
                    const first = viewer.dataHelper.sphericalCoordsToViewerCoords({ yaw: pts[0][0] * RAD, pitch: pts[0][1] * RAD })
                    if (first) {
                        const dx = data.viewerX - first.x, dy = data.viewerY - first.y
                        if (Math.sqrt(dx * dx + dy * dy) < 24) {
                            lastVertexRef.current = { yaw, pitch, t: now }
                            setPolygonPopup({ mode: 'new', points: pts, status: 'available', label: '', detail: {} })
                            setDrawingPolygon(null)
                            return
                        }
                    }
                } catch {}
            }

            lastVertexRef.current = { yaw, pitch, t: now }
            setDrawingPolygon(prev => prev ? { points: [...prev.points, [yaw, pitch]] } : prev)
        })

        psvRef.current           = viewer
        markersPluginRef.current = mp

        return () => {
            viewer.destroy()
            psvRef.current           = null
            markersPluginRef.current = null
            viewerSceneIdRef.current = null
        }
    }, [activeScene]) // eslint-disable-line

    // ── Marker sync — arrows + cover-ups, diffed by PSV itself ──────────────
    // While a hotspot/cover-up is being edited, it's excluded from this list and
    // rendered instead as a plain draggable React element — PSV markers have no
    // native drag-to-reposition, so the item being pointed at swaps to DOM, the
    // same pattern this app already used for hotspot placement.
    useEffect(() => {
        const mp     = markersPluginRef.current
        const viewer = psvRef.current
        if (!mp || !viewer || !activeScene) return

        const arrowMarkers = hotspots
            .filter(h => h.scene_id === activeScene.id && h.id !== editingId)
            .map(h => {
                const arrow = ARROWS.find(a => a.type === h.arrow_type) || ARROWS[0]
                return {
                    id: `hs_${h.id}`,
                    type: 'image',
                    image: arrow.gif,
                    size: { width: hotspotSize, height: hotspotSize },
                    position: { yaw: `${h.yaw}deg`, pitch: `${h.pitch}deg` },
                    tooltip: h.label || undefined,
                    data: { hotspotDbId: h.id },
                }
            })

        const baseHfov = activeScene.initial_hfov ?? 120
        const coverupMarkers = visibleCoverups
            .filter(c => c.id !== selectedOverlay) // the selected one is rendered as plain DOM instead
            .map(c => {
                const aspect = coverupAspect[c.id] ?? 1
                return {
                    id: `cv_${c.id}`,
                    type: 'image',
                    image: c.url,
                    size: { width: c.size, height: c.size * aspect },
                    position: { yaw: `${c.yaw}deg`, pitch: `${c.pitch}deg` },
                    opacity: c.opacity,
                    rotation: `${c.rotation}deg`,
                    // Grows/shrinks with zoom so it keeps covering the same
                    // physical spot on the photo — the same intent as
                    // Pannellum's old scale:true.
                    scale: (zoomLevel) => {
                        try { return baseHfov / viewer.dataHelper.zoomLevelToFov(zoomLevel) }
                        catch { return 1 }
                    },
                    data: { coverupId: c.id },
                }
            })

        // Zones. Points are immutable once drawn, so — unlike hotspots/cover-ups
        // — the one open in the popup never needs excluding here; only its
        // fill color changes, via the hover handlers registered at init.
        const polygonMarkers = visiblePolygons.map(p => {
            const c = colorForStatus(p.status)
            return {
                id: `poly_${p.id}`,
                type: 'polygon',
                polygon: p.points.map(([yaw, pitch]) => [`${yaw}deg`, `${pitch}deg`]),
                svgStyle: { fill: c + '55', stroke: c, strokeWidth: '2' },
                data: { polygonId: p.id },
            }
        })

        // Live preview while placing vertices — a growing dashed line, same
        // pattern already validated in the polygon spike.
        const previewMarkers = (drawingPolygon && drawingPolygon.points.length >= 2)
            ? [{
                id: 'poly_preview',
                type: 'polyline',
                polyline: drawingPolygon.points.map(([yaw, pitch]) => [`${yaw}deg`, `${pitch}deg`]),
                svgStyle: { stroke: '#a3e635', strokeWidth: '2', strokeDasharray: '6,4', fill: 'none' },
            }]
            : []

        const next = [...coverupMarkers, ...polygonMarkers, ...previewMarkers, ...arrowMarkers]
        try {
            mp.setMarkers(next)
        } catch {
            // Fallback if this PSV version lacks the bulk-replace method.
            mp.clearMarkers()
            for (const m of next) { try { mp.addMarker(m) } catch {} }
        }
    }, [hotspots, visibleCoverups, visiblePolygons, drawingPolygon, activeScene, hotspotSize, editingId, selectedOverlay, coverupAspect])

    // ── rAF — keeps the placement pin + selected cover-up projected on screen
    const mainLoop = useCallback(() => {
        // While the preview modal is open, stop projecting/setting state every
        // frame — it would re-render the editor (and the modal) needlessly.
        if (previewOpenRef.current) { rafRef.current = requestAnimationFrame(mainLoop); return }

        const viewer = psvRef.current
        const ps     = popupRef.current

        let pitch, yaw
        if      (ps?.mode === 'new' || ps?.mode === 'edit-existing')  { pitch = ps.pitch;          yaw = ps.yaw }
        else if (ps?.mode === 'confirm-edit' || ps?.mode === 'saved') { pitch = ps.hotspot?.pitch;  yaw = ps.hotspot?.yaw }

        if (viewer && pitch != null && yaw != null) {
            try {
                const pt = viewer.dataHelper.sphericalCoordsToViewerCoords({ yaw: yaw * RAD, pitch: pitch * RAD })
                setPinPos(pt || null)
            } catch { setPinPos(null) }
        } else {
            setPinPos(null)
        }

        // The selected cover-up (confirm bubble or edit form) is world-anchored,
        // so — same as the pin — it needs a live projected position.
        const selId = selectedOverlayRef.current
        const cov   = selId ? coverupsRef.current.find(c => c.id === selId) : null
        if (viewer && cov) {
            try {
                const pt   = viewer.dataHelper.sphericalCoordsToViewerCoords({ yaw: cov.yaw * RAD, pitch: cov.pitch * RAD })
                const hfov = viewer.dataHelper.zoomLevelToFov(viewer.getZoomLevel())
                setCoverupPopupScreen(pt ? { x: pt.x, y: pt.y, hfov } : null)
            } catch { setCoverupPopupScreen(null) }
        } else {
            setCoverupPopupScreen(null)
        }

        // Polygon popup ('new' before it's saved, or 'view'/'edit' on an
        // existing zone) is anchored to the shape's centroid.
        const pp  = polygonPopupRef.current
        const pts = pp ? (pp.mode === 'new' ? pp.points : pp.polygon?.points) : null
        if (viewer && pts?.length) {
            try {
                const c  = centroidOf(pts)
                const pt = viewer.dataHelper.sphericalCoordsToViewerCoords({ yaw: c.yaw * RAD, pitch: c.pitch * RAD })
                setPolygonPopupScreen(pt || null)
            } catch { setPolygonPopupScreen(null) }
        } else {
            setPolygonPopupScreen(null)
        }

        rafRef.current = requestAnimationFrame(mainLoop)
    }, []) // eslint-disable-line

    useEffect(() => {
        rafRef.current = requestAnimationFrame(mainLoop)
        return () => cancelAnimationFrame(rafRef.current)
    }, [mainLoop])

    // ── sampleAt — screen → sphere coords ─────────────────────────────────
    const sampleAt = useCallback((clientX, clientY) => {
        const viewer = psvRef.current, el = viewerRef.current
        if (!viewer || !el) return null
        const { left, top } = el.getBoundingClientRect()
        try {
            const sph = viewer.dataHelper.viewerCoordsToSphericalCoords({ x: clientX - left, y: clientY - top })
            if (!sph) return null
            return { pitch: sph.pitch * DEG, yaw: sph.yaw * DEG }
        } catch { return null }
    }, [])

    // ── Drag / drop ────────────────────────────────────────────────────────
    const onViewerDragOver = useCallback(e => { e.preventDefault(); setIsDragOver(true) }, [])
    const onViewerDrop     = useCallback(e => {
        e.preventDefault(); setIsDragOver(false)
        const sceneData   = e.dataTransfer.getData('scene')
        const hotspotType = e.dataTransfer.getData('hotspot-type')
        if (sceneData) { setActiveScene(JSON.parse(sceneData)); return }
        if (hotspotType) {
            if (drawingPolygon) return // drawing a zone takes priority over placing a new arrow
            const coords = sampleAt(e.clientX, e.clientY)
            if (!coords) return
            setPopupState({ mode: 'new', arrow_type: hotspotType, ...coords, label: '', target_scene_id: '' })
        }
    }, [sampleAt, drawingPolygon])

    const onOverlayMouseMove = useCallback(e => {
        if (!isDraggingPin) return
        const coords = sampleAt(e.clientX, e.clientY)
        if (coords) setPopupState(prev =>
            (prev?.mode === 'new' || prev?.mode === 'edit-existing') ? { ...prev, ...coords } : prev
        )
    }, [isDraggingPin, sampleAt])

    // ── Overlay persistence ────────────────────────────────────────────────
    // Logos live on the project, cover-ups on the scene. Both are saved as a
    // whole array — they are small, and a partial write would let the client
    // and the row disagree about ordering.
    // Both of these used to fail silently — an `if (res.ok)` with no else. The
    // overlay stayed on screen because local state had already been set, so the
    // editor looked right while nothing had been written, and the overlay was
    // simply absent from Preview and from the published tour. Say so instead.
    //
    // Logos and the cover-up both live on the project row, so one PATCH carries
    // whichever of them changed.
    async function saveOverlayFields(fields) {
        if (!project) return false
        setOverlayError('')
        try {
            const res  = await fetch(`/api/projects/${project.id}`, {
                method: 'PATCH', headers: {'Content-Type':'application/json'},
                body: JSON.stringify(fields),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setOverlayError(json.error || `Overlays not saved (${res.status}).`)
                return false
            }
            setProject(json.project)
            setLogos(projectLogos(json.project))       // trust the server's normalised copy
            setCoverups(projectCoverups(json.project))
            return true
        } catch {
            setOverlayError('Network error — nothing was saved.')
            return false
        }
    }

    // ── Save ───────────────────────────────────────────────────────────────
    // One button, one write. Files whose overlays were removed are deleted only
    // after the row is safely updated — the reverse order would destroy an image
    // the user could still get back by leaving without saving.
    // Returns true on success (including "nothing to save"), false if the write
    // failed — publishTour relies on this to know whether to proceed.
    async function saveOverlays() {
        if (!dirtyLogos && !dirtyCoverups) return true
        setSavingOverlays(true)
        setOverlayError('')
        try {
            const fields = {}
            if (dirtyLogos)    fields.overlays = logos
            if (dirtyCoverups) fields.coverups = coverups
            if (!await saveOverlayFields(fields)) return false

            setDirtyLogos(false)
            setDirtyCoverups(false)

            const urls = pendingDeletesRef.current
            pendingDeletesRef.current = []
            for (const url of urls) {
                fetch(`/api/projects/${project.id}/overlay-image`, {
                    method: 'DELETE', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ url }),
                }).catch(() => {})
            }

            setSavedTick(true)
            setTimeout(() => setSavedTick(false), 2000)
            return true
        } finally {
            setSavingOverlays(false)
        }
    }

    const patchLogo = (id, f) => {
        setDirtyLogos(true); setSavedTick(false)
        setLogos(prev => prev.map(l => l.id === id ? { ...l, ...f } : l))
    }

    // A panel row is just a pointer: clicking it selects the overlay AND opens
    // its edit dialog on the overlay itself in the viewer. If the overlay is
    // scoped to a scene you're not in, switch to that scene first so it's on
    // screen. Clicking the row it's already editing closes the dialog.
    function openOverlayEditor(id) {
        if (editOverlay === id) { setEditOverlay(null); setSelectedOverlay(null); return }
        const cv = coverups.find(c => c.id === id)
        const lg = logos.find(l => l.id === id)
        const target = cv || lg
        if (target && target.scene_id != null && target.scene_id !== activeScene?.id) {
            const sc = scenes.find(s => s.id === target.scene_id)
            if (sc) setActiveScene(sc)   // viewer reads activeScene directly
        }
        setSelectedOverlay(id)
        setEditOverlay(id)
    }

    // Flip an overlay between this-scene and every-scene. sceneId is either the
    // active scene's id or null.
    function setOverlayScope(id, sceneId) {
        if (logos.some(l => l.id === id))    { patchLogo(id, { scene_id: sceneId }); return }
        if (coverups.some(c => c.id === id)) { patchCoverup(id, { scene_id: sceneId }) }
    }

    const patchCoverup = (id, f) => {
        setDirtyCoverups(true); setSavedTick(false)
        setCoverups(prev => prev.map(c => c.id === id ? { ...c, ...f } : c))
    }

    // ── Adding ─────────────────────────────────────────────────────────────
    // Upload first, then append. If the upload fails nothing is written, so the
    // arrays never hold a URL that 404s.
    async function uploadOverlayImage(file) {
        const fd = new FormData()
        fd.append('file', file)
        const res  = await fetch(`/api/projects/${project.id}/overlay-image`, { method: 'POST', body: fd })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || 'Upload failed.')
        return json.url
    }

    async function addLogo(file) {
        if (!project) return 'No project loaded.'
        try {
            const url  = await uploadOverlayImage(file)
            const item = { id: newOverlayId('lg'), url, ...LOGO_DEFAULTS, scene_id: activeScene?.id ?? null }
            setLogos([...logos, item])
            setSelectedOverlay(item.id)
            setEditOverlay(item.id)
            setDirtyLogos(true); setSavedTick(false)
        } catch (e) { return e.message }
    }

    // A new cover-up starts at the nadir (over the tripod) and defaults to
    // this scene — the common case is hiding something in the room you are in.
    // Switch it to every-scene from the panel.
    async function addCoverup(file) {
        if (!project) return 'No project loaded.'
        try {
            const url = await uploadOverlayImage(file)
            const item = { id: newOverlayId('cv'), url, ...COVERUP_DEFAULTS, scene_id: activeScene?.id ?? null }
            setCoverups(prev => [...prev, item])
            setSelectedOverlay(item.id)
            setEditOverlay(item.id)
            setDirtyCoverups(true); setSavedTick(false)
        } catch (e) { return e.message }
    }

    function deleteLogo(id) {
        const gone = logos.find(l => l.id === id)
        if (gone) pendingDeletesRef.current.push(gone.url)
        setLogos(logos.filter(l => l.id !== id))
        if (selectedOverlay === id) setSelectedOverlay(null)
        if (editOverlay === id) setEditOverlay(null)
        setDirtyLogos(true); setSavedTick(false)
    }

    function deleteCoverup(id) {
        const gone = coverups.find(c => c.id === id)
        if (gone) pendingDeletesRef.current.push(gone.url)
        setCoverups(coverups.filter(c => c.id !== id))
        if (selectedOverlay === id) setSelectedOverlay(null)
        if (editOverlay === id) setEditOverlay(null)
        setDirtyCoverups(true); setSavedTick(false)
    }

    // ── Dragging ───────────────────────────────────────────────────────────
    // Two coordinate systems, one gesture. A logo moves in screen percent; a
    // cover-up is re-sampled into pitch/yaw exactly like a hotspot, so it stays
    // welded to the wall it is hiding.
    // Click an overlay → select it and show the "Edit?" bubble (like hotspots).
    // Dragging is armed only once edit mode is confirmed, so a stray click can't
    // nudge a placed logo or cover-up.
    function onOverlayMouseDown(e, id) {
        e.preventDefault(); e.stopPropagation()
        if (editOverlay !== id) {
            // Not yet editing this one — select and ask, don't drag.
            setSelectedOverlay(id)
            setEditOverlay(null)
            return
        }
        startOverlayDrag(e, id)
    }

    function startOverlayDrag(e, id) {
        e.preventDefault(); e.stopPropagation()
        setSelectedOverlay(id)
        setDraggingOverlay(id)

        const logo = logos.find(l => l.id === id)
        const el   = viewerRef.current
        if (logo && el) {
            const rect = el.getBoundingClientRect()
            const cx = rect.left + (logo.x / 100) * rect.width
            const cy = rect.top  + (logo.y / 100) * rect.height
            logoDragRef.current = { offX: e.clientX - cx, offY: e.clientY - cy }
        }
    }

    function onOverlayDragMove(e) {
        if (!draggingOverlay) return
        const el = viewerRef.current
        if (!el) return

        const logo = logos.find(l => l.id === draggingOverlay)
        if (logo) {
            const rect = el.getBoundingClientRect()
            const { offX, offY } = logoDragRef.current || { offX: 0, offY: 0 }
            const x = ((e.clientX - offX - rect.left) / rect.width)  * 100
            const y = ((e.clientY - offY - rect.top)  / rect.height) * 100
            patchLogo(draggingOverlay, clampLogo({ ...logo, x, y }, rect))
            return
        }

        // Re-sample into pitch/yaw so the patch stays welded to the same point
        // on the sphere.
        const coords = sampleAt(e.clientX, e.clientY)
        if (coords) patchCoverup(draggingOverlay, { pitch: roundTo2(coords.pitch), yaw: roundTo2(coords.yaw) })
    }

    // Keep the WHOLE logo inside the viewer on all four sides, ROTATION INCLUDED.
    // The anchor is the logo's centre. A rotated rectangle's on-screen footprint
    // (its axis-aligned bounding box) is w·|cos θ| + h·|sin θ| wide and
    // w·|sin θ| + h·|cos θ| tall — bigger than the unrotated box — so we inset by
    // HALF of that footprint on each axis. Logos don't rotate today, but this is
    // correct if they ever do, and identical to the simple case when θ = 0.
    function clampLogo(logo, rect) {
        const vw = rect?.width  || viewerSize.w || 1
        const vh = rect?.height || viewerSize.h || 1

        const boxW = logo.size                                   // rendered width in px
        const boxH = logo.size * (logoAspect[logo.id] || 1)      // height from aspect ratio
        const rad  = ((logo.rotation || 0) * Math.PI) / 180
        const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad))
        const footW = boxW * c + boxH * s
        const footH = boxW * s + boxH * c

        const halfW = (footW / 2 / vw) * 100
        const halfH = (footH / 2 / vh) * 100
        // Too big for an axis → centre it there rather than jam a corner off-screen.
        const x = halfW * 2 >= 100 ? 50 : Math.min(100 - halfW, Math.max(halfW, logo.x))
        const y = halfH * 2 >= 100 ? 50 : Math.min(100 - halfH, Math.max(halfH, logo.y))
        return { x: roundTo2(x), y: roundTo2(y) }
    }

    function endOverlayDrag() {
        if (!draggingOverlay) return
        setDraggingOverlay(null)
        // Position already lives in state from the drag itself; releasing just
        // ends the gesture. Nothing is written until Save.
    }

    // ── API: create hotspot ────────────────────────────────────────────────
    async function saveHotspot() {
        if (popupState?.mode !== 'new' || !popupState.target_scene_id || !project) return
        dispatchFlag('savingHotspot')
        try {
            const res = await fetch('/api/hotspots', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({
                    project_id: project.id, scene_id: activeScene.id,
                    pitch: roundTo2(popupState.pitch), yaw: roundTo2(popupState.yaw),
                    arrow_type: popupState.arrow_type, label: popupState.label || '',
                    target_scene_id: popupState.target_scene_id,
                }),
            })
            if (res.ok) {
                const { hotspot } = await res.json()
                setHotspots(prev => [...prev, hotspot])
                setPopupState(null)
            }
        } finally { dispatchFlag('savingHotspot') }
    }

    // ── API: update hotspot ────────────────────────────────────────────────
    async function updateHotspot() {
        if (popupState?.mode !== 'edit-existing' || !popupState.target_scene_id) return
        const hotspotId = popupState.hotspot.id
        dispatchFlag('savingHotspot')
        try {
            const res = await fetch(`/api/hotspots/${hotspotId}`, {
                method: 'PATCH', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({
                    label:           popupState.label || '',
                    target_scene_id: popupState.target_scene_id,
                    pitch:           roundTo2(popupState.pitch),
                    yaw:             roundTo2(popupState.yaw),
                    arrow_type:      popupState.arrow_type,
                }),
            })
            if (res.ok) {
                const { hotspot } = await res.json()
                setHotspots(prev => prev.map(h => h.id === hotspot.id ? hotspot : h))
                setPopupState(null)
            } else {
                const err = await res.json().catch(() => ({}))
                console.error('PATCH hotspot failed:', res.status, err?.error)
            }
        } finally { dispatchFlag('savingHotspot') }
    }

    function handleSave() {
        if (popupState?.mode === 'new')           saveHotspot()
        if (popupState?.mode === 'edit-existing') updateHotspot()
    }

    // Ask before deleting — the panel's trash button opens this confirmation.
    function requestDeleteHotspot(id) {
        setHotspotToDelete(hotspots.find(h => h.id === id) || { id })
    }

    async function confirmDeleteHotspot() {
        if (!hotspotToDelete) return
        setDeletingHotspot(true)
        try {
            await fetch(`/api/hotspots/${hotspotToDelete.id}`, { method: 'DELETE' })
            setHotspots(prev => prev.filter(h => h.id !== hotspotToDelete.id))
            if (popupState?.hotspot?.id === hotspotToDelete.id) setPopupState(null)
        } finally {
            setDeletingHotspot(false)
            setHotspotToDelete(null)
        }
    }

    // ── Polygon zones ──────────────────────────────────────────────────────
    function startDrawingPolygon() {
        if (!activeScene) return
        setPolygonPopup(null)
        setPolygonError('')
        lastVertexRef.current = null
        setDrawingPolygon({ points: [] })
    }

    function cancelDrawingPolygon() {
        setDrawingPolygon(null)
    }

    function finishDrawingPolygon() {
        if (!drawingPolygon || drawingPolygon.points.length < 3) return
        setPolygonPopup({ mode: 'new', points: drawingPolygon.points, status: 'available', label: '', detail: {} })
        setDrawingPolygon(null)
    }

    async function savePolygon() {
        if (polygonPopup?.mode !== 'new' || !project || !activeScene) return
        setSavingPolygon(true)
        setPolygonError('')
        try {
            const res = await fetch('/api/polygons', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: project.id, scene_id: activeScene.id,
                    points: polygonPopup.points,
                    status: polygonPopup.status, label: polygonPopup.label, detail: polygonPopup.detail,
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) { setPolygonError(json.error || 'Could not save the zone.'); return }
            setPolygons(prev => [...prev, json.polygon])
            setPolygonPopup(null)
        } catch {
            setPolygonError('Network error — the zone was not saved.')
        } finally {
            setSavingPolygon(false)
        }
    }

    async function updatePolygon() {
        if (polygonPopup?.mode !== 'edit' || !polygonPopup.polygon) return
        setSavingPolygon(true)
        setPolygonError('')
        try {
            const res = await fetch(`/api/polygons/${polygonPopup.polygon.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: polygonPopup.status, label: polygonPopup.label, detail: polygonPopup.detail }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) { setPolygonError(json.error || 'Could not save the zone.'); return }
            setPolygons(prev => prev.map(p => p.id === json.polygon.id ? json.polygon : p))
            setPolygonPopup(null)
        } catch {
            setPolygonError('Network error — the zone was not saved.')
        } finally {
            setSavingPolygon(false)
        }
    }

    function handlePolygonSave() {
        if (polygonPopup?.mode === 'new')  savePolygon()
        if (polygonPopup?.mode === 'edit') updatePolygon()
    }

    // Panel row click / re-click toggles the view card, same affordance as the
    // overlay panel's rows.
    function selectPolygon(id) {
        if (polygonPopup?.polygon?.id === id && polygonPopup.mode === 'view') { setPolygonPopup(null); return }
        const p = polygons.find(x => x.id === id)
        if (!p) return
        setPolygonPopup({ mode: 'view', polygon: p })
    }

    function editPolygon() {
        setPolygonPopup(prev => prev?.polygon ? {
            mode: 'edit', polygon: prev.polygon,
            status: prev.polygon.status, label: prev.polygon.label, detail: prev.polygon.detail,
        } : prev)
    }

    async function deletePolygon(id) {
        setDeletingPolygon(true)
        try {
            await fetch(`/api/polygons/${id}`, { method: 'DELETE' })
            setPolygons(prev => prev.filter(p => p.id !== id))
            if (polygonPopup?.polygon?.id === id) setPolygonPopup(null)
        } finally {
            setDeletingPolygon(false)
        }
    }

    // Common hotspot arrow size — saved on the project, exactly like logo size.
    async function saveHotspotSize(size) {
        if (!project) return
        try {
            const res = await fetch(`/api/projects/${project.id}`, {
                method: 'PATCH', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ hotspot_size: Math.round(size) }),
            })
            if (res.ok) { const { project: updated } = await res.json(); setProject(updated) }
        } catch {}
    }

    async function deleteProject() {
        dispatchFlag('deleting')
        try {
            const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
            if (res.ok) router.push('/360editor')
        } finally { dispatchFlag('deleting') }
    }

    async function saveSettings() {
        if (!settingsDraft) return
        dispatchFlag('savingSettings')
        try {
            const res = await fetch(`/api/projects/${project.id}`, {
                method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(settingsDraft),
            })
            if (res.ok) {
                const { project: updated } = await res.json()
                setProject(updated)
                setShowSettings(false)
            }
        } finally { dispatchFlag('savingSettings') }
    }

    function openPreview() {
        if (!scenes.length || !project) return
        previewOpenRef.current = true
        setPreviewHtml(buildTourHtml({ project, scenes, hotspots, polygons }))
    }

    // ── Publish ────────────────────────────────────────────────────────────
    // Freezes the tour as it stands and serves it from a permanent URL:
    //   https://<site>/<user_id>/<project-slug>
    // The URL is assigned on the first publish and never changes afterwards —
    // publishing again overwrites what that same link serves, so a link already
    // sent to a client keeps working and simply shows the newer tour.
    async function publishTour() {
        if (!scenes.length || !project) return
        setPublishError('')
        dispatchFlag('publishing')
        try {
            // Publish snapshots what is IN THE DATABASE. Overlay edits live in
            // local state until Save, so an unsaved change would silently not
            // appear on the live tour — the exact "I updated but nothing changed"
            // bug. Flush pending overlays before snapshotting.
            if (dirtyLogos || dirtyCoverups) {
                const ok = await saveOverlays()
                if (!ok) {
                    setPublishError('Your overlay changes could not be saved, so the tour was not published.')
                    return
                }
            }

            const res  = await fetch(`/api/projects/${project.id}/publish`, { method: 'POST' })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) { setPublishError(json.error || 'Publish failed. Try again.'); return }

            // Store the CLEAN url — this is what gets shown and copied. The public
            // route is already no-store, so the link itself needs no cache-buster.
            setPublicUrl(json.url)
            setProject(p => p ? { ...p, slug: json.slug, published_at: json.published_at } : p)
        } catch {
            setPublishError('Network error — the tour was not published.')
        } finally { dispatchFlag('publishing') }
    }

    // Takes the tour offline. The slug is kept, so re-publishing later restores
    // the exact same link.
    async function unpublishTour() {
        if (!project) return
        setPublishError('')
        dispatchFlag('unpublishing')
        try {
            const res = await fetch(`/api/projects/${project.id}/publish`, { method: 'DELETE' })
            if (res.ok) {
                setPublicUrl(null)
                setProject(p => p ? { ...p, published_at: null } : p)
            } else {
                const json = await res.json().catch(() => ({}))
                setPublishError(json.error || 'Could not unpublish.')
            }
        } catch {
            setPublishError('Network error — the tour is still live.')
        } finally { dispatchFlag('unpublishing') }
    }

    // Clean link for display and copy; freshly cache-busted only when opened, so
    // the editor never shows a stale tour after re-publishing without polluting
    // the link a client receives.
    const openUrl = () => publicUrl ? `${publicUrl}?v=${Date.now().toString(36)}` : '#'

    async function copyLink() {
        if (!publicUrl) return
        try { await navigator.clipboard.writeText(publicUrl) }
        catch {
            const ta = Object.assign(document.createElement('textarea'), { value: publicUrl })
            document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove()
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
    }

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-[#FAFAF7]">
            <Spinner size={20}/>
        </div>
    )

    const hasPopup  = popupState !== null
    const isEditing = popupState?.mode === 'new' || popupState?.mode === 'edit-existing'

    // The one selected cover-up, if any — rendered as plain DOM (see the marker
    // sync effect for why: PSV markers can't be dragged natively).
    const selectedCoverup = coverups.find(c => c.id === selectedOverlay)

    return (
        <>
            <div className="h-screen flex flex-col bg-[#FAFAF7] overflow-hidden">

                {/* ── Top bar ── */}
                <header className="h-[52px] flex items-center px-5 gap-3 border-b border-[#E2E2DA] bg-white shrink-0 z-10">
                    <Link href="/360editor" className="flex items-center gap-1.5 text-[#6b6b60] hover:text-[#1a1a18] transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                        <span className="text-[12px] font-medium">Dashboard</span>
                    </Link>
                    <span className="text-[#E2E2DA]">/</span>
                    <div className="flex items-center gap-2 mr-auto">
                        <div className="w-6 h-6 bg-[#3730a3] rounded-md flex items-center justify-center shrink-0">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                            </svg>
                        </div>
                        <span className="text-[#1a1a18] font-semibold text-[14px] truncate">{project?.name}</span>
                    </div>
                    {activeScene && <span className="text-[12px] text-[#6b6b60] truncate hidden sm:block">{activeScene.name}</span>}

                    {/* Settings */}
                    <button
                        onClick={() => { setSettingsDraft({ show_intro: project?.show_intro??true, auto_rotate: project?.auto_rotate??-3 }); setShowSettings(true) }}
                        title="Project settings"
                        className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#E2E2DA] text-[#6b6b60] hover:bg-[#F4F4EF] transition-colors shrink-0">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                    </button>

                    {/* Delete */}
                    <button onClick={() => setConfirmDelete(true)} title="Delete project"
                            className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#E2E2DA] text-[#6b6b60] hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                    </button>

                    {/* Preview */}
                    <button onClick={openPreview} disabled={!scenes.length}
                            title="Preview the tour exactly as it will be exported"
                            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#E2E2DA] text-[#6b6b60] text-[12px] font-medium hover:bg-[#F4F4EF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                        Preview
                    </button>

                    {/* Publish — creates (or refreshes) the permanent public link */}
                    <button onClick={publishTour} disabled={flags.publishing || !scenes.length}
                            title={publicUrl ? 'Push the current version to the live link' : 'Host this tour on a permanent public link'}
                            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#3730a3] text-white text-[12px] font-semibold hover:bg-[#312e81] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
                        {flags.publishing
                            ? <><Spinner/>{publicUrl ? 'Updating…' : 'Publishing…'}</>
                            : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><polyline points="8 7 12 3 16 7"/><line x1="12" y1="3" x2="12" y2="15"/></svg>{publicUrl ? 'Update live tour' : 'Publish'}</>}
                    </button>
                </header>

                {/* ── Live link bar — appears once the tour has been published ── */}
                {publicUrl && (
                    <div className="h-9 flex items-center gap-2 px-5 border-b border-[#E2E2DA] bg-[#F4F4EF] shrink-0">
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>Live
                        </span>
                        <a href={openUrl()} target="_blank" rel="noreferrer"
                           className="text-[12px] text-[#3730a3] hover:underline truncate font-medium">
                            {publicUrl.replace(/^https?:\/\//, '')}
                        </a>
                        <button onClick={copyLink}
                                className="ml-auto flex items-center gap-1 h-6 px-2 rounded-md border border-[#E2E2DA] bg-white text-[11px] font-medium text-[#6b6b60] hover:text-[#1a1a18] transition-colors shrink-0">
                            {copied
                                ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
                                : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy link</>}
                        </button>
                        <a href={openUrl()} target="_blank" rel="noreferrer"
                           className="flex items-center gap-1 h-6 px-2 rounded-md border border-[#E2E2DA] bg-white text-[11px] font-medium text-[#6b6b60] hover:text-[#1a1a18] transition-colors shrink-0">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Open
                        </a>
                        <button onClick={unpublishTour} disabled={flags.unpublishing}
                                title="Take the tour offline (the link is kept and can be restored)"
                                className="flex items-center gap-1 h-6 px-2 rounded-md border border-[#E2E2DA] bg-white text-[11px] font-medium text-[#6b6b60] hover:border-red-300 hover:text-red-500 disabled:opacity-40 transition-colors shrink-0">
                            {flags.unpublishing ? <Spinner size={11}/> : 'Unpublish'}
                        </button>
                    </div>
                )}

                {publishError && (
                    <div className="h-8 flex items-center gap-2 px-5 border-b border-red-200 bg-red-50 text-[11px] font-medium text-red-600 shrink-0">
                        {publishError}
                        <button onClick={() => setPublishError('')} className="ml-auto text-red-400 hover:text-red-600">Dismiss</button>
                    </div>
                )}

                {overlayError && (
                    <div className="h-8 flex items-center gap-2 px-5 border-b border-red-200 bg-red-50 text-[11px] font-medium text-red-600 shrink-0">
                        {overlayError}
                        <button onClick={() => setOverlayError('')} className="ml-auto text-red-400 hover:text-red-600">Dismiss</button>
                    </div>
                )}

                {polygonError && (
                    <div className="h-8 flex items-center gap-2 px-5 border-b border-red-200 bg-red-50 text-[11px] font-medium text-red-600 shrink-0">
                        {polygonError}
                        <button onClick={() => setPolygonError('')} className="ml-auto text-red-400 hover:text-red-600">Dismiss</button>
                    </div>
                )}

                {/* ── Body ── */}
                <div className="flex-1 flex overflow-hidden">

                    {/* Left — scenes */}
                    <div className="w-[180px] shrink-0 relative overflow-hidden">
                        <ScenePanel projectId={projectId} scenes={scenes}
                                    onScenesChange={updated => { setScenes(updated); if (!activeScene && updated.length) setActiveScene(updated[0]) }}/>
                    </div>

                    {/* Middle — viewer */}
                    <div className="flex-1 relative overflow-hidden bg-[#F4F4EF]">
                        {!activeScene ? (
                            <div className={`absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed transition-colors ${isDragOver ? 'border-[#3730a3] bg-[#3730a3]/5' : 'border-[#E2E2DA]'}`}
                                 onDragOver={onViewerDragOver} onDragLeave={() => setIsDragOver(false)} onDrop={onViewerDrop}>
                                <div className="w-16 h-16 bg-[#3730a3]/8 rounded-2xl flex items-center justify-center mb-4">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="1.5">
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                                    </svg>
                                </div>
                                <p className="text-[14px] font-semibold text-[#1a1a18]">Drop a scene here</p>
                                <p className="text-[12px] text-[#6b6b60] mt-1">Drag an image from the left panel</p>
                            </div>
                        ) : (
                            <>
                                <div ref={viewerRef}
                                     className={`absolute inset-0 ${isDragOver ? 'ring-2 ring-[#3730a3] ring-inset' : ''}`}
                                     onDragOver={onViewerDragOver} onDragLeave={() => setIsDragOver(false)} onDrop={onViewerDrop}/>

                                {/* ── Selected cover-up — the only one rendered as plain DOM.
                                    Every other cover-up is a PSV marker (see the marker-sync
                                    effect); PSV has no native marker-dragging, so the one being
                                    pointed at swaps to a draggable element, exactly the pattern
                                    already used for hotspot placement below. */}
                                {selectedCoverup && coverupPopupScreen && (() => {
                                    const c = selectedCoverup
                                    const zoom = (activeScene.initial_hfov ?? 120) / (coverupPopupScreen.hfov || activeScene.initial_hfov || 120)
                                    const editing = editOverlay === c.id
                                    const w = c.size * zoom
                                    return (
                                        <div className="absolute z-10" style={{ left: coverupPopupScreen.x, top: coverupPopupScreen.y, transform: 'translate(-50%,-50%)' }}>
                                            <img
                                                src={c.url}
                                                alt=""
                                                draggable={false}
                                                onMouseDown={e => { if (editing) startOverlayDrag(e, c.id) }}
                                                style={{
                                                    width: w,
                                                    opacity: c.opacity,
                                                    transform: `rotate(${c.rotation}deg)`,
                                                    outline: `2px ${editing ? 'solid' : 'dashed'} #3730a3`,
                                                    outlineOffset: '2px',
                                                    display: 'block',
                                                }}
                                                className={`select-none h-auto ${editing ? (draggingOverlay === c.id ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-pointer'}`}
                                            />
                                            {!draggingOverlay && (
                                                <OverlayPopup item={c} kind="coverup"
                                                              editing={editing}
                                                              screenPos={coverupPopupScreen}
                                                              halfW={w / 2} halfH={w / 2}
                                                              viewerSize={viewerSize}
                                                              activeSceneId={activeScene?.id} activeSceneName={activeScene?.name}
                                                              onEdit={() => setEditOverlay(c.id)}
                                                              onPatch={patchCoverup} onSetScope={setOverlayScope}
                                                              onDelete={() => deleteCoverup(c.id)}
                                                              onClose={() => { setEditOverlay(null); setSelectedOverlay(null) }}/>
                                            )}
                                        </div>
                                    )
                                })()}

                                {/* ── Logos — pinned to the screen ──
                                    Percent of the viewer, so they hold their place while the
                                    visitor looks around, on every scene. */}
                                {visibleLogos.map(l => {
                                    const sel = selectedOverlay === l.id
                                    // Clamp the rendered position too, so a logo saved near an edge
                                    // (or resized bigger than the frame) still shows fully.
                                    const cp = clampLogo(l, null)
                                    return (
                                        <div key={l.id} className="absolute z-20" style={{ left: `${cp.x}%`, top: `${cp.y}%`, transform: 'translate(-50%,-50%)' }}>
                                            <img
                                                src={l.url}
                                                alt=""
                                                draggable={false}
                                                onMouseDown={e => onOverlayMouseDown(e, l.id)}
                                                onLoad={e => {
                                                    // Remember the true aspect ratio so the clamp knows the
                                                    // logo's real height, not just its width.
                                                    const r = e.currentTarget.naturalHeight / (e.currentTarget.naturalWidth || 1)
                                                    setLogoAspect(prev => prev[l.id] === r ? prev : { ...prev, [l.id]: r })
                                                }}
                                                style={{
                                                    width: l.size,
                                                    opacity: l.opacity,
                                                    outline: sel ? `2px ${editOverlay === l.id ? 'solid' : 'dashed'} #3730a3` : 'none',
                                                    outlineOffset: '2px',
                                                    display: 'block',
                                                }}
                                                className={`select-none h-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] ${
                                                    editOverlay === l.id
                                                        ? (draggingOverlay === l.id ? 'cursor-grabbing' : 'cursor-grab')
                                                        : 'cursor-pointer'
                                                }`}
                                            />
                                            {sel && !draggingOverlay && (
                                                <OverlayPopup item={l} kind="logo"
                                                              editing={editOverlay === l.id}
                                                              screenPos={{ x: (cp.x/100)*(viewerSize.w||0), y: (cp.y/100)*(viewerSize.h||0) }}
                                                              halfW={l.size / 2} halfH={(l.size * (logoAspect[l.id] || 1)) / 2}
                                                              viewerSize={viewerSize}
                                                              activeSceneId={activeScene?.id} activeSceneName={activeScene?.name}
                                                              onEdit={() => setEditOverlay(l.id)}
                                                              onPatch={patchLogo} onSetScope={setOverlayScope}
                                                              onDelete={() => deleteLogo(l.id)}
                                                              onClose={() => { setEditOverlay(null); setSelectedOverlay(null) }}/>
                                            )}
                                        </div>
                                    )
                                })}

                                {/* Capture surface while an overlay is being dragged */}
                                {draggingOverlay && (
                                    <div className="absolute inset-0 z-40 cursor-grabbing"
                                         onMouseMove={onOverlayDragMove}
                                         onMouseUp={endOverlayDrag}
                                         onMouseLeave={endOverlayDrag}/>
                                )}

                                {isDraggingPin && (
                                    <div className="absolute inset-0 z-40 cursor-crosshair"
                                         onMouseMove={onOverlayMouseMove}
                                         onMouseUp={() => setIsDraggingPin(false)}
                                         onMouseLeave={() => setIsDraggingPin(false)}/>
                                )}

                                {/* While editing/placing: the draggable handle IS the real
                                    arrow image (same gif the exported tour uses) — WYSIWYG,
                                    no crosshair/pointer. */}
                                {hasPopup && isEditing && pinPos && (
                                    <img
                                        src={(ARROWS.find(a => a.type === popupState.arrow_type) || ARROWS[0]).gif}
                                        alt=""
                                        draggable={false}
                                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setIsDraggingPin(true) }}
                                        style={{ left: pinPos.x, top: pinPos.y, width: hotspotSize, height: hotspotSize, transform: 'translate(-50%,-50%)' }}
                                        className={`absolute z-30 object-contain select-none drop-shadow-[0_3px_12px_rgba(0,0,0,0.85)] ${isDraggingPin ? 'cursor-grabbing' : 'cursor-grab'}`}
                                    />
                                )}

                                {hasPopup && (
                                    <HotspotPopup
                                        pos={pinPos}
                                        viewerSize={viewerSize}
                                        state={popupState}
                                        scenes={scenes}
                                        activeSceneId={activeScene?.id}
                                        onUpdate={setPopupState}
                                        onSave={handleSave}
                                        onCancel={() => setPopupState(null)}
                                        saving={flags.savingHotspot}
                                    />
                                )}

                                {polygonPopup && (
                                    <PolygonPopup
                                        pos={polygonPopupScreen}
                                        viewerSize={viewerSize}
                                        state={polygonPopup}
                                        onUpdate={setPolygonPopup}
                                        onSave={handlePolygonSave}
                                        onEdit={editPolygon}
                                        onDelete={() => deletePolygon(polygonPopup.polygon.id)}
                                        onCancel={() => setPolygonPopup(null)}
                                        saving={savingPolygon}
                                        deleting={deletingPolygon}
                                    />
                                )}

                                {isEditing && !isDraggingPin && (
                                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-black/65 backdrop-blur text-white text-[11px] font-medium px-3 py-1.5 rounded-full">
                                        Drag the arrow to adjust · fill form in popup
                                    </div>
                                )}
                                {isDraggingPin && (
                                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-black/65 backdrop-blur text-white text-[11px] font-medium px-3 py-1.5 rounded-full">
                                        Release to place
                                    </div>
                                )}
                                {draggingOverlay && (
                                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-black/65 backdrop-blur text-white text-[11px] font-medium px-3 py-1.5 rounded-full">
                                        {logos.some(l => l.id === draggingOverlay)
                                            ? 'Drag the logo · it stays put on screen'
                                            : 'Drag the cover-up · it moves in every scene at once'}
                                    </div>
                                )}
                                {drawingPolygon && (
                                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-black/70 backdrop-blur text-white text-[11px] font-medium px-3 py-1.5 rounded-full">
                                        <span>
                                            {drawingPolygon.points.length} point{drawingPolygon.points.length === 1 ? '' : 's'}
                                            {' · '}{drawingPolygon.points.length < 3 ? 'need 3+ to finish' : 'click Finish, or click back on your first point'}
                                        </span>
                                        <button onClick={finishDrawingPolygon} disabled={drawingPolygon.points.length < 3}
                                                className="h-6 px-2.5 rounded-full bg-[#3730a3] text-white font-semibold disabled:opacity-40 transition-colors">
                                            Finish
                                        </button>
                                        <button onClick={cancelDrawingPolygon}
                                                className="h-6 px-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white font-semibold transition-colors">
                                            Cancel
                                        </button>
                                    </div>
                                )}

                                <CameraControls psvRef={psvRef}/>
                            </>
                        )}
                    </div>

                    {/* Right — directions on top, overlays underneath */}
                    <div className="w-[220px] shrink-0 relative overflow-hidden flex flex-col">
                        <div className="flex-1 min-h-0 relative overflow-hidden">
                            <HotspotPanel scenes={scenes} activeSceneId={activeScene?.id}
                                          hotspots={hotspots} onDeleteHotspot={requestDeleteHotspot}
                                          hotspotSize={hotspotSize}
                                          onHotspotSizeChange={setHotspotSize}
                                          onHotspotSizeCommit={saveHotspotSize}/>
                        </div>
                        <div className="h-[220px] shrink-0 border-t border-[#E2E2DA]">
                            <OverlayPanel
                                logos={logos}
                                coverups={coverups}
                                selectedId={selectedOverlay}
                                activeSceneId={activeScene?.id}
                                hasActiveScene={!!activeScene}
                                onSelect={openOverlayEditor}
                                onAddLogo={addLogo}
                                onAddCoverup={addCoverup}
                                onDeleteLogo={deleteLogo}
                                onDeleteCoverup={deleteCoverup}
                                dirty={dirtyLogos || dirtyCoverups}
                                saving={savingOverlays}
                                saved={savedTick}
                                onSave={saveOverlays}/>
                        </div>
                        <div className="h-[220px] shrink-0 border-t border-[#E2E2DA]">
                            <PolygonPanel
                                polygons={visiblePolygons}
                                selectedId={polygonPopup?.polygon?.id ?? null}
                                activeSceneId={activeScene?.id}
                                drawing={!!drawingPolygon}
                                onStartDraw={startDrawingPolygon}
                                onSelect={selectPolygon}
                                onDelete={deletePolygon}/>
                        </div>
                    </div>
                </div>
            </div>

            {showSettings && settingsDraft && (
                <SettingsModal draft={settingsDraft} onChange={setSettingsDraft}
                               onSave={saveSettings} onClose={() => setShowSettings(false)}
                               saving={flags.savingSettings}/>
            )}
            {confirmDelete && (
                <DeleteModal projectName={project?.name} onConfirm={deleteProject}
                             onClose={() => setConfirmDelete(false)} deleting={flags.deleting}/>
            )}
            {hotspotToDelete && (
                <HotspotDeleteModal hotspot={hotspotToDelete}
                                    targetName={scenes.find(s => s.id === hotspotToDelete.target_scene_id)?.name}
                                    onConfirm={confirmDeleteHotspot}
                                    onClose={() => setHotspotToDelete(null)}
                                    deleting={deletingHotspot}/>
            )}
            {previewHtml && (
                <TourPreviewModal html={previewHtml} projectName={project?.name}
                                  onClose={() => { previewOpenRef.current = false; setPreviewHtml(null) }}/>
            )}
        </>
    )
}
