'use client'
import React, { useEffect, useRef, useState, useCallback, useReducer, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Viewer } from '@photo-sphere-viewer/core'
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin'
import '@photo-sphere-viewer/core/index.css'
import '@photo-sphere-viewer/markers-plugin/index.css'
import '@/components/360editor/project/landmark-marker.css'
import ScenePanel       from '@/components/360editor/project/scene_panel'
import HotspotPanel from '@/components/360editor/project/hotspot_panel'
import OverlayPanel from '@/components/360editor/project/overlay_panel'
import PolygonPanel from '@/components/360editor/project/polygon_panel'
import PanelTabs from '@/components/360editor/project/panel_tabs'
import { ARROWS, FLOOR_SIZE_MULTIPLIER } from '@/lib/arrows'
import { HOTSPOT_COLORS, DEFAULT_HOTSPOT_COLOR, LABEL_COLORS, DEFAULT_LABEL_COLOR } from '@/lib/hotspots'
import { newOverlayId, LOGO_DEFAULTS, COVERUP_DEFAULTS, projectLogos, projectCoverups, overlaysForScene } from '@/lib/overlays'
import { colorForStatus, normalizeEdgeLengths } from '@/lib/polygons'
import TourPreviewModal from '@/components/360editor/project/preview'
import { buildTourHtml, escapeHtml } from '@/components/360editor/project/export'
import { roundTo2, flagsInit, flagsReducer } from '@/components/360editor/project/editor_utils'
import { Spinner, CameraControls, SettingsModal, ConfirmDeleteModal, ErrorBanner, OverlayRow, EmbedModal } from '@/components/360editor/project/editor_modals'
import { isPublishCycleExpired, publishCycleEndsAt } from '@/lib/publish-cycle'

// Radians <-> degrees. Hotspot/overlay data is stored in degrees everywhere
// (DB, API, React state) exactly as before the viewer swap — PSV's Position
// type is radians, so conversion happens only at the two dataHelper boundary
// calls (sampleAt, mainLoop) and nowhere else. Marker *configs* skip this
// entirely by using PSV's degree-suffixed string form ("12.3deg").
const RAD = Math.PI / 180
const DEG = 180 / Math.PI

// While drawing a zone, a click within this many screen px of an existing
// vertex (another saved zone's, or the shape currently being drawn) snaps
// onto that exact point instead of a new nearby one — lets adjacent zones
// share a real, identical edge instead of two visually-close-but-different
// ones from re-clicking by eye each time.
const SNAP_PX = 16
function findSnapPoint(viewer, candidates, screenX, screenY) {
    let best = null, bestDist = SNAP_PX
    for (const [yaw, pitch] of candidates) {
        try {
            const pt = viewer.dataHelper.sphericalCoordsToViewerCoords({ yaw: yaw * RAD, pitch: pitch * RAD })
            if (!pt) continue
            const d = Math.hypot(pt.x - screenX, pt.y - screenY)
            if (d < bestDist) { bestDist = d; best = [yaw, pitch] }
        } catch {}
    }
    return best
}

// Fallback opening horizontal FOV when a scene has no saved initial_hfov —
// there's no UI yet to set/save a custom one per scene (the column and
// PATCH /api/scenes/[id] support it, nothing calls it), so every scene opens
// at this value. Lower = more zoomed in. 70deg reads as a closer, more
// immersive opening view than the previous 90deg default without going so
// narrow it hides the room's edges. Kept as one constant since it has to
// stay consistent with the cover-up scale-with-zoom math, which anchors to
// the same "opening FOV" — and must match export.jsx's own DEFAULT_HFOV so
// a published tour's opening view matches what the editor showed.
const DEFAULT_HFOV = 62

// Markup for the 'landmark' arrow_type — a PSV `html` marker (unlike every
// other arrow type, which is a plain `image` marker), because the floating
// label has to show this hotspot's own text, not a fixed sprite. See
// landmark-marker.css for the .lm-*/@keyframes rules, and export.jsx's
// arrowMarker() for the from-scratch duplicate this needs for the published
// tour (no shared module between the two). label is untrusted user text
// going into raw HTML, so it's always escaped here.
//
// --lm-height/--lm-color are baked into an inline style ATTRIBUTE on the
// returned markup itself, rather than left to be set later via PSV's own
// marker `style` config. PSV applies that config with
// `Object.assign(element.style, config.style)` — a plain property
// assignment, not `style.setProperty()` — which doesn't reliably set CSS
// custom properties (React's own style prop explicitly uses setProperty
// for dashed keys for exactly this reason). That mismatch is why the edit
// preview — plain React DOM, styled the normal React way — always looked
// right, while the actual saved PSV marker silently kept falling back to
// each variable's CSS default (48px / indigo) no matter what was saved.
// An inline `style="..."` HTML attribute, parsed by the browser itself
// while setting innerHTML, doesn't go through that code path at all.
function landmarkMarkerHtml(label, height, color, labelColor) {
    const h  = Number.isFinite(height) ? height : 48
    const c  = /^#[0-9a-f]{6}$/i.test(color || '') ? color : DEFAULT_HOTSPOT_COLOR
    const lc = /^#[0-9a-f]{6}$/i.test(labelColor || '') ? labelColor : DEFAULT_LABEL_COLOR
    return `<div class="lm" style="--lm-height:${h}px;--lm-color:${c};--lm-label-color:${lc}"><div class="lm-label">${escapeHtml(label || 'Landmark')}</div>`
        + `<div class="lm-line"></div><div class="lm-dot"></div></div>`
}


// Rotate-handle cursor — a curved arrow, the near-universal convention for a
// rotate control (Figma, Canva, PowerPoint, Photoshop's free-transform all
// use this shape). No native CSS cursor keyword for "rotate" exists, so this
// is a small inline SVG (white fill, dark outline for contrast against any
// part of the photo) used as a custom cursor image; "grab" is the fallback
// if the browser can't load a custom cursor. The "10 10" hotspot centers the
// cursor's pointer on the icon rather than its top-left corner.
const ROTATE_CURSOR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">'
    + '<circle cx="10" cy="10" r="7" fill="none" stroke="black" stroke-width="2.5" stroke-dasharray="34 8" stroke-linecap="round"/>'
    + '<circle cx="10" cy="10" r="7" fill="none" stroke="white" stroke-width="1.1" stroke-dasharray="34 8" stroke-linecap="round"/>'
    + '<polygon points="15.2,3.6 19.4,6.4 13.6,8.2" fill="black"/>'
    + '<polygon points="15.5,4.4 18.3,6.3 14.6,7.5" fill="white"/>'
    + '</svg>'
const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(ROTATE_CURSOR_SVG)}") 10 10, grab`

// Overlay editing card — styled to match the hotspot popup (light card, indigo
// header, right-of-target with edge fallback), so overlays and hotspots feel
// like one system. Two modes:
//   confirm — "Edit this logo/cover-up?" with No / Yes, edit
//   edit    — scope switch + size/opacity(/rotate) sliders
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

            <div className="bg-white/95 backdrop-blur-md rounded-xl border border-editor-border shadow-editor-popup overflow-hidden">

                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-editor-primary/6 border-b border-editor-border">
                    <div className="w-5 h-5 rounded border border-editor-border bg-white overflow-hidden flex items-center justify-center shrink-0">
                        <img src={item.url} alt="" className="max-w-full max-h-full object-contain"/>
                    </div>
                    <span className="text-[11px] font-bold text-editor-primary flex-1">
                        {editing ? `Edit ${isLogo ? 'logo' : 'cover-up'}` : `Edit ${isLogo ? 'logo' : 'cover-up'}?`}
                    </span>
                    <button onClick={onClose} className="text-editor-ink-dim hover:text-editor-ink transition-colors shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                </div>

                {/* Confirm */}
                {!editing && (
                    <div className="px-3 py-3 space-y-2.5">
                        <div>
                            <p className="text-[12px] font-semibold text-editor-ink">
                                {isLogo ? 'Logo' : 'Cover-up'}
                            </p>
                            <p className="text-[11px] text-editor-ink-muted mt-0.5 flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${everyScene ? 'bg-emerald-400' : 'bg-editor-primary'}`}/>
                                {everyScene ? 'Every scene' : (item.scene_id === activeSceneId ? 'This scene' : 'Another scene')}
                            </p>
                        </div>
                        <p className="text-[11px] text-editor-ink-muted">Edit this {isLogo ? 'logo' : 'cover-up'}?</p>
                        <div className="flex gap-1.5">
                            <button onClick={onDelete}
                                    className="flex-1 h-7 text-[11px] rounded-lg border border-editor-border text-red-500 hover:bg-red-50 transition-colors">
                                Delete
                            </button>
                            <button onClick={onEdit}
                                    className="flex-1 h-7 text-[11px] rounded-lg bg-editor-primary text-white font-semibold hover:bg-editor-primary-hover transition-colors">
                                Yes, edit
                            </button>
                        </div>
                    </div>
                )}

                {/* Edit */}
                {editing && (
                    <div className="px-3 py-3 space-y-2.5">
                        <div>
                            <p className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium mb-1">Show in</p>
                            <div className="flex p-0.5 rounded-lg bg-editor-subtle border border-editor-border">
                                <button onClick={() => onSetScope(item.id, null)}
                                        className={`flex-1 h-6 rounded-md text-[10.5px] font-semibold transition-colors ${everyScene ? 'bg-white text-editor-primary shadow-sm' : 'text-editor-ink-dim hover:text-editor-ink-muted'}`}>
                                    Every scene
                                </button>
                                <button onClick={() => activeSceneId && onSetScope(item.id, activeSceneId)} disabled={!activeSceneId}
                                        title={activeSceneName ? `Only ${activeSceneName}` : undefined}
                                        className={`flex-1 h-6 rounded-md text-[10.5px] font-semibold transition-colors disabled:opacity-40 ${!everyScene ? 'bg-white text-editor-primary shadow-sm' : 'text-editor-ink-dim hover:text-editor-ink-muted'}`}>
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
                                    className="flex-1 h-7 text-[11px] rounded-lg border border-editor-border text-red-500 hover:bg-red-50 transition-colors">
                                Delete
                            </button>
                            <button onClick={onClose}
                                    className="flex-1 h-7 text-[11px] rounded-lg bg-editor-primary text-white font-semibold hover:bg-editor-primary-hover transition-colors">
                                Done
                            </button>
                        </div>
                        <p className="text-[10px] text-editor-ink-dim leading-snug">
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
    const handleSaveRef    = useRef(null)    // mirrors handleSave, called from the document-level "click outside auto-saves" listener (mounted once, needs the CURRENT closure, not a stale one from mount time)
    const pinBoxRef        = useRef(null)    // the hotspot pin's drag/resize/rotate box — clicks inside it must not count as "outside"
    const hotspotFormRef   = useRef(null)    // wraps the hotspot form now rendered inside HotspotPanel (right column) — same reason: clicks inside it must not count as "outside" either
    const savingNewHotspotRef = useRef(false) // re-entrancy guard for saveHotspot — see its own comment
    const hotspotSizeRef    = useRef(90)     // mirrors hotspotSize, read inside the rAF loop's floor-decal live preview
    const floorPreviewKeyRef = useRef(null)  // last-applied {yaw,pitch,size,rotate_x,rotate_y,rotation} snapshot for 'hs_floor_preview' — skips the (expensive, WebGL-flickering) updateMarker call on frames where nothing actually changed
    const onHotspotClickRef = useRef(null)
    const onCoverupClickRef = useRef(null)
    const onPolygonClickRef = useRef(null)
    const lastVertexRef     = useRef(null)   // { yaw, pitch, t } — guards against a click double-firing
    const drawCursorRef     = useRef(null)   // { x, y } client coords, for the live rubber-band preview line
    const logoDragRef       = useRef(null)   // { offX, offY } in px while dragging a logo
    const overlayGestureRef = useRef(null)   // { mode:'resize'|'rotate', id, cxPage, cyPage, startSize, startDist } while resizing/rotating a cover-up
    const pinGestureRef     = useRef(null)   // { mode:'resize'|'rotate', cxPage, cyPage, startSize, startDist } while resizing/rotating the hotspot placement pin
    const vertexDragRef     = useRef(null)   // index of the polygon corner being dragged, while editing a zone's shape
    const polygonVertexScreensRef = useRef([]) // mirrors polygonVertexScreens, read inside the rAF loop to skip redundant setState calls
    const [logoAspect, setLogoAspect] = useState({}) // logo id -> naturalHeight/naturalWidth
    const [coverupAspect, setCoverupAspect] = useState({}) // coverup id -> naturalHeight/naturalWidth
    const coverupsRef       = useRef([])     // full coverups list, read inside the rAF loop by id
    const selectedOverlayRef = useRef(null)  // mirrors selectedOverlay, read inside the rAF loop
    const polygonsRef        = useRef([])    // full polygons list, read inside the marker click/hover handlers
    const hotspotsRef        = useRef([])    // full hotspots list — onViewerDrop's deps don't include `hotspots`, so it'd otherwise see a stale snapshot when auto-numbering a new one ("Hotspot N")
    const drawingPolygonRef  = useRef(null)  // mirrors drawingPolygon, read inside the PSV click handler
    // Every distinct point placed since "Start Drawing", across every split
    // so far in this session — NOT reset when a loop closes and gets carved
    // off. drawingPolygon.points only ever holds the CURRENTLY OPEN shape
    // (so the live preview line and the loop just extracted don't drag in
    // stale geometry from earlier shapes); this is the separate, ever-
    // growing history that lets a later shape in the same stroke close by
    // revisiting a point from an EARLIER, already-finished shape (e.g.
    // triangle 1-2-3 closes and is saved, then drawing 1-4-2 needs to
    // recognize "2" as a real point to close back onto even though it's no
    // longer part of the open shape).
    const sessionPointsRef   = useRef([])
    // Next default "Zone N" number for this drawing session — set from the
    // scene's existing zone count when drawing starts, then incremented
    // synchronously (not after a save resolves) so two zones auto-split in
    // quick succession, before either save's response comes back, can't
    // both land on the same number.
    const zoneNumberRef      = useRef(1)
    const polygonPopupRef    = useRef(null)  // mirrors polygonPopup, read inside the rAF loop's corner-handle projection
    const polygonSaveTimerRef = useRef(null) // debounce timer for the zone form's auto-save (see the useEffect below)
    const polygonSavedFlashTimerRef = useRef(null) // clears the "Saved" confirmation a moment after it appears
    const previewOpenRef    = useRef(false)  // pause the rAF loop while the preview modal is open

    const [project, setProject]                 = useState(null)
    const [scenes, setScenes]                   = useState([])
    const [hotspots, setHotspots]               = useState([])
    const [activeScene, setActiveScene]         = useState(null)
    const [loading, setLoading]                 = useState(true)
    const [isDragOver, setIsDragOver]           = useState(false)
    const [isDraggingPin, setIsDraggingPin]     = useState(false)
    const [activeRightTab, setActiveRightTab]   = useState('directions') // 'directions' | 'overlays' | 'zones'
    // Side-panel visibility — each panel keeps its old fixed width; a small
    // toggle button on its outer edge hides/shows it entirely instead of
    // letting it be dragged narrower/wider.
    const [leftPanelOpen, setLeftPanelOpen]   = useState(true)
    const [rightPanelOpen, setRightPanelOpen] = useState(true)
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
    const [downloadingZip, setDownloadingZip]   = useState(false)
    const [zipError, setZipError]               = useState('')
    const [renewing, setRenewing]               = useState(false)
    const [renewError, setRenewError]           = useState('')

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
    const [showEmbedModal, setShowEmbedModal]   = useState(false)

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
    const [polygonToDelete, setPolygonToDelete] = useState(null) // set by requestDeletePolygon; confirmed via the modal near the other delete confirmations
    const [savingView, setSavingView]           = useState(false)
    const [savedViewTick, setSavedViewTick]     = useState(false)

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
    const [polygonVertexScreens, setPolygonVertexScreens] = useState([]) // [{x,y}, ...] — this frame's screen position of each corner handle while editing a zone's shape
    const [isDraggingVertex, setIsDraggingVertex]     = useState(false)
    const [savingPolygon, setSavingPolygon]     = useState(false)
    const [justSavedPolygon, setJustSavedPolygon] = useState(false) // brief "Saved" confirmation after an auto-save lands
    const [deletingPolygon, setDeletingPolygon] = useState(false)
    const [polygonError, setPolygonError]       = useState('')

    // popupState modes: 'new' | 'edit-existing' — null means nothing is
    // being created/edited, and the right panel shows its normal palette
    // + saved-hotspots list instead of the form (see HotspotPanel).
    const [popupState, setPopupState] = useState(null)

    scenesRef.current         = scenes
    popupRef.current          = popupState
    hotspotSizeRef.current    = hotspotSize
    handleSaveRef.current     = handleSave
    coverupsRef.current       = coverups
    selectedOverlayRef.current = selectedOverlay
    polygonsRef.current       = polygons
    hotspotsRef.current       = hotspots
    drawingPolygonRef.current = drawingPolygon
    polygonPopupRef.current   = polygonPopup
    polygonVertexScreensRef.current = polygonVertexScreens

    // What the ACTIVE scene displays: every-scene overlays + those scoped here.
    // Memoized — these feed the marker-sync effect's dependency array below,
    // and an unmemoized .filter()/map() returns a brand-new array reference
    // on every render regardless of whether logos/coverups/polygons actually
    // changed. That meant the effect (and its mp.setMarkers() full rebuild)
    // reran on EVERY render — including every single popupState update while
    // dragging a hotspot's resize/rotate handle or, worse, a floor decal's
    // rotation sliders — constantly wiping the imperative live-preview
    // marker built for it in mainLoop and fighting over it every frame: the
    // exact cause of both "all hotspots flicker" and "the decal isn't
    // visible while editing."
    const visibleLogos    = useMemo(() => overlaysForScene(logos,    activeScene?.id), [logos, activeScene?.id])
    const visibleCoverups = useMemo(() => overlaysForScene(coverups, activeScene?.id), [coverups, activeScene?.id])
    // Zones are always scene-scoped — no "every scene" concept.
    const visiblePolygons = useMemo(() => polygons.filter(p => p.scene_id === activeScene?.id), [polygons, activeScene?.id])

    // Id of the hotspot currently being edited (stable primitive for effect deps)
    const editingId = popupState?.mode === 'edit-existing' ? popupState.hotspot?.id : null
    // Id of the zone currently having its corners dragged — its saved marker
    // is hidden while this is set; the live shape is drawn separately from
    // polygonPopup.points instead (see the JSX corner-handle overlay), which
    // is why "points are immutable" no longer holds for the open one.
    const editingPolygonId = polygonPopup?.mode === 'edit' ? polygonPopup.polygon?.id : null

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

    // Ctrl+Z (or Cmd+Z) while drawing a zone undoes the last placed point.
    // Reads drawingPolygonRef so this only needs to mount once; preventDefault
    // only fires while actively drawing, so undo anywhere else on the page
    // (an input field, etc.) is untouched.
    useEffect(() => {
        function onKeyDown(e) {
            if (!drawingPolygonRef.current || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
            const pts = drawingPolygonRef.current.points
            if (!pts.length) return
            e.preventDefault()
            // Only pop it from the session history too if it was actually
            // the most recent point added there — a point that's the start
            // of the open shape because it's a just-closed loop's shared
            // vertex (not a fresh click) must stay in history so it's still
            // revisit-able for whatever gets drawn next.
            const removed = pts[pts.length - 1]
            const hist = sessionPointsRef.current
            if (hist.length && hist[hist.length - 1] === removed) {
                sessionPointsRef.current = hist.slice(0, -1)
            }
            setDrawingPolygon(prev => prev ? { points: prev.points.slice(0, -1) } : prev)
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])

    // Delete/Esc while a hotspot or zone form is open — Delete asks to
    // delete it (same confirmation the form's own Delete button opens, never
    // an immediate delete), Esc saves whatever's pending and backs out to
    // the list (the same thing the header's Save button does). Delete is
    // ignored while focus is inside a text field (an input/textarea/select,
    // or anything contentEditable) — otherwise deleting text in the label
    // field would delete the whole hotspot/zone the moment it hit the end of
    // the string. Esc has no such normal in-field meaning, so it isn't
    // guarded the same way — pressing it while still focused in the
    // (autoFocus'd) label field still saves and exits, which is the point.
    useEffect(() => {
        function isTextField(el) {
            if (!el) return false
            const tag = el.tagName
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
        }
        function onKeyDown(e) {
            // Never hijack the key while some other modal (a delete
            // confirmation, settings, preview) already owns the keyboard.
            if (hotspotToDelete || polygonToDelete || confirmDelete || showSettings || previewHtml) return
            if (e.key === 'Delete') {
                if (isTextField(document.activeElement)) return
                if (popupState?.mode === 'edit-existing') { e.preventDefault(); requestDeleteHotspot(popupState.hotspot.id) }
                else if (polygonPopup?.mode === 'edit') { e.preventDefault(); requestDeletePolygon(polygonPopup.polygon.id) }
            } else if (e.key === 'Escape') {
                if (popupState?.mode === 'new' || popupState?.mode === 'edit-existing') { e.preventDefault(); handleSave() }
                else if (polygonPopup?.mode === 'edit') { e.preventDefault(); saveZoneNow() }
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [popupState, polygonPopup, hotspotToDelete, polygonToDelete, confirmDelete, showSettings, previewHtml])

    // Clicking away from an open hotspot form (placing a new one, or
    // editing an existing one — the form itself now lives in the right
    // panel, see HotspotPanel/HotspotForm, not floating next to the pin)
    // auto-saves instead of requiring an explicit Save click — Cancel still
    // discards deliberately. A document-level mousedown, not a click, so it
    // fires (and commits the save) even when the "elsewhere" is itself the
    // start of a new interaction — e.g. clicking straight onto a different
    // hotspot's marker to edit that one instead, or clicking a different
    // right-panel tab (Overlays/Zones), which unmounts HotspotPanel's form
    // entirely — the save has to already be in flight before that happens.
    // Every interactive control inside the form and the pin's own drag/
    // resize/rotate box already calls stopPropagation on its own mousedown
    // (see startPinResize/startPinRotate/startAxisRotate etc.), so this only
    // ever fires for genuine outside clicks; the ref .contains() checks are
    // a second line of defense for the form's plain controls (inputs, the
    // scene <select>, sliders), which don't stop propagation — without them,
    // clicking into the Label field to type would itself count as "outside"
    // and immediately save-and-close.
    useEffect(() => {
        function onDocMouseDown(e) {
            const ps = popupRef.current
            if (!ps || (ps.mode !== 'new' && ps.mode !== 'edit-existing')) return
            if (hotspotFormRef.current?.contains(e.target)) return
            if (pinBoxRef.current?.contains(e.target)) return
            handleSaveRef.current?.()
        }
        document.addEventListener('mousedown', onDocMouseDown)
        return () => document.removeEventListener('mousedown', onDocMouseDown)
    }, [])

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
        // A zone form open on the 'zones' tab must be flushed (not just
        // abandoned) before switching to 'directions' here — otherwise
        // activeRightTab changes but polygonPopup doesn't, and the render
        // below (gated on activeRightTab === 'directions' && !polygonPopup)
        // would keep showing the zone form under a "Directions" tab label.
        closePolygonPopup()
        // Straight into edit mode — the bounding box on the canvas already
        // doubles as the confirmation that you're about to change something,
        // so a separate "Edit this hotspot?" step was just extra friction.
        setPopupState({
            mode: 'edit-existing',
            hotspot: h,
            arrow_type: h.arrow_type,
            pitch: h.pitch,
            yaw: h.yaw,
            label: h.label || '',
            target_scene_id: h.target_scene_id,
            // null = no per-hotspot override, keeps following the tour-wide
            // slider — only a real number here permanently decouples this
            // one hotspot from it.
            size: h.size ?? null,
            rotation: h.rotation ?? 0,
            color: h.color || DEFAULT_HOTSPOT_COLOR,
            label_color: h.label_color || DEFAULT_LABEL_COLOR,
            rotate_x: h.rotate_x ?? 90, rotate_y: h.rotate_y ?? 0,
            action_type: h.action_type || 'navigate',
            link_url: h.link_url || '', info_body: h.info_body || '', info_image_url: h.info_image_url || '',
            info_fields: h.info_fields || [],
            toggle_target_id: h.toggle_target_id || '', start_hidden: !!h.start_hidden,
            animate_line: h.animate_line !== false,
            custom_icon_url: h.custom_icon_url || '',
        })
        setActiveRightTab('directions')
    }
    onCoverupClickRef.current = (coverupId) => {
        if (!coverupId) return
        closePolygonPopup() // see onHotspotClickRef's comment on this
        setSelectedOverlay(coverupId)
        setEditOverlay(null)
        setActiveRightTab('overlays')
    }
    onPolygonClickRef.current = (polygonId) => {
        const p = polygons.find(x => x.id === polygonId)
        if (!p) return
        closePolygonPopup(polygonEditState(p))
        setActiveRightTab('zones')
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
            // clickEventOnMarker: by default PSV swallows a click that lands
            // on top of a marker (arrow, cover-up, or a zone's own fill) —
            // it fires select-marker and calls stopImmediatePropagation, so
            // the plain viewer 'click' below never sees it. That's exactly
            // where a vertex often needs to land while drawing (an adjacent
            // zone is a big filled region, easy to click inside by
            // accident), so points would silently fail to place. This makes
            // marker clicks ALSO reach the normal click handler; outside
            // drawing mode it's a no-op (the handler bails out immediately
            // when nothing is being drawn).
            plugins: [[MarkersPlugin, { clickEventOnMarker: true }]],
        })

        // PSV's zoom axis (0-100) isn't the same as Pannellum's hfov degrees —
        // convert once the instance is ready so the opening view matches what
        // was saved.
        viewer.addEventListener('ready', () => {
            try { viewer.zoom(viewer.dataHelper.fovToZoomLevel(activeScene.initial_hfov ?? DEFAULT_HFOV)) } catch {}
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
            const c = colorForStatus(p.status, p.custom_color)
            mp.updateMarker({ id: marker.id, svgStyle: { fill: c + '99', stroke: c, strokeWidth: '3' } })
        })
        mp.addEventListener('leave-marker', ({ marker }) => {
            if (!marker.id.startsWith('poly_')) return
            const p = polygonsRef.current.find(x => x.id === marker.data?.polygonId)
            if (!p) return
            const c = colorForStatus(p.status, p.custom_color)
            mp.updateMarker({ id: marker.id, svgStyle: { fill: c + '55', stroke: c, strokeWidth: '2' } })
        })
        // Click-to-place-vertex while drawing a zone. A raw viewer click (not
        // a marker select), fired regardless of what's under the cursor.
        //
        // A click within SNAP_PX of an existing vertex — another saved
        // zone's, or one already placed in the shape being traced — locks
        // onto that exact point instead of the raw click position, so
        // adjacent zones can share a real, identical edge.
        //
        // A click that snaps onto one of THIS shape's own already-placed
        // points (as opposed to a fresh spot, or a point borrowed from
        // another saved zone) means the stroke has looped back on itself —
        // like closing a boundary with a paint-bucket tool, that loop is a
        // complete, fillable region on its own. It's committed as its own
        // zone immediately (no popup — a fill tool doesn't ask you to name
        // the region before filling it; rename it after from the panel) and
        // the rest of the stroke keeps going from that shared point, so
        // tracing a second shape straight into the first without lifting the
        // pen (e.g. a roof triangle flowing into the body below it) produces
        // two zones sharing an edge, not one fused shape. An earlier attempt
        // only checked the shape's very first point for this, which missed
        // exactly this case — a shape can close on ANY of its own points,
        // not just point 1, and it can happen more than once per stroke.
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
            let yaw   = data.yaw   * DEG
            let pitch = data.pitch * DEG

            const currentPts = drawingPolygonRef.current.points

            // A click landing back on the point you JUST placed — however
            // many times, however far apart in time, as long as the cursor
            // never actually moved off it — is always a no-op: not a new
            // point, and not a close either. This has to be checked purely
            // by position (not the old 250ms window), because repeated
            // clicks at a frozen cursor position can be spaced well over
            // 250ms apart and each one that slipped through was ADDING a
            // fresh near-duplicate point at that spot; a couple of those
            // piling up was enough to pass the 3-point minimum and trigger
            // an unwanted close on the click after.
            const lastPt = currentPts[currentPts.length - 1]
            if (lastPt) {
                try {
                    const p = viewer.dataHelper.sphericalCoordsToViewerCoords({ yaw: lastPt[0] * RAD, pitch: lastPt[1] * RAD })
                    if (p && Math.hypot(p.x - data.viewerX, p.y - data.viewerY) < SNAP_PX) return
                } catch {}
            }

            // Self-revisit is checked against EVERY point placed this whole
            // drawing session (sessionPointsRef), not just the currently
            // open shape — closing a later shape can revisit a point from an
            // earlier shape that's already been carved off and saved (e.g.
            // triangle 1-2-3 closes and saves, then drawing 1-4-2 needs "2"
            // to still count as a real point to close onto, even though it's
            // no longer in the open shape). This search is kept separate
            // from (and prioritized over) snapping to another SAVED zone's
            // corner — folding them into one merged list would let ties
            // resolve to the wrong copy of an identical coordinate.
            const selfSnapped = findSnapPoint(viewer, sessionPointsRef.current, data.viewerX, data.viewerY)

            let snapped = selfSnapped
            if (!snapped) {
                const otherPoints = polygonsRef.current.filter(p => p.scene_id === activeScene.id).flatMap(p => p.points)
                snapped = findSnapPoint(viewer, otherPoints, data.viewerX, data.viewerY)
            }
            if (snapped) { [yaw, pitch] = snapped }

            // Belt and suspenders against React Strict Mode's double-invoked
            // effects in dev possibly overlapping two Viewer instances for a
            // moment, each registering its own listener against the same
            // shared setDrawingPolygon — the position check above can't
            // catch that case because both duplicate listeners fire before
            // either has updated currentPts.
            const last = lastVertexRef.current
            const now  = Date.now()
            if (last && now - last.t < 250 && Math.abs(yaw - last.yaw) < 0.05 && Math.abs(pitch - last.pitch) < 0.05) {
                return
            }

            if (selfSnapped) {
                // Revisiting a point still inside the open shape closes it
                // as-is (drop anything before that point — same as before).
                // Revisiting a point from an EARLIER, already-saved shape
                // isn't in currentPts at all, so it's the missing closing
                // vertex — append it to complete the loop.
                const idxInOpen = currentPts.indexOf(selfSnapped)
                const loop = idxInOpen !== -1 ? currentPts.slice(idxInOpen) : [...currentPts, selfSnapped]
                if (loop.length >= 3) {
                    saveAutoPolygon(loop)
                    // Stops here, one zone per "Draw zone" click — drawing
                    // used to re-arm itself with the closing point as the
                    // next shape's first vertex so several zones could be
                    // chained without pressing "Draw zone" again, but that
                    // read as it "not stopping" after a shape completed.
                    setDrawingPolygon(null)
                    lastVertexRef.current = null
                    return
                }
                // Too few points to form a closed shape yet — fall through
                // and place it as an ordinary (snapped-coordinate) point.
            }

            const newPt = [yaw, pitch]
            lastVertexRef.current = { yaw, pitch, t: now }
            sessionPointsRef.current = [...sessionPointsRef.current, newPt]
            setDrawingPolygon(prev => prev ? { points: [...prev.points, newPt] } : prev)
        })

        // Tracked purely for the live rubber-band preview line drawn each
        // frame in mainLoop — cheap to update on every move, unlike the
        // declarative marker list which would mean a full arrows/cover-ups/
        // zones rebuild dozens of times a second if driven from here instead.
        // viewerRef.current is the persistent React-owned container (reused
        // across scene switches, unlike the Viewer instance itself) — the
        // listener has to be explicitly removed below or every scene switch
        // would stack another one on top of it.
        const drawContainer = viewerRef.current
        const onDrawMouseMove = e => { drawCursorRef.current = { x: e.clientX, y: e.clientY } }
        drawContainer.addEventListener('mousemove', onDrawMouseMove)

        psvRef.current           = viewer
        markersPluginRef.current = mp

        return () => {
            drawContainer.removeEventListener('mousemove', onDrawMouseMove)
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
                const size = h.size ?? hotspotSize
                // Landmark is an `html` marker (a per-hotspot line+label
                // built from its own text), not an `image` sprite like every
                // other arrow type — see landmarkMarkerHtml. anchor:'bottom
                // center' puts the pulsing dot exactly on the saved point,
                // with the line+label stacking upward from there. Rotation
                // is deliberately not applied (a vertical line rotating in
                // the screen plane doesn't mean anything).
                if (h.arrow_type === 'landmark') {
                    return {
                        id: `hs_${h.id}`,
                        type: 'html',
                        // height (this hotspot's own `size`, same drag-to-
                        // resize control every other type uses) and color
                        // are baked into the markup's own inline style
                        // attribute by landmarkMarkerHtml — see its comment
                        // for why that's necessary instead of PSV's `style`
                        // marker config. The dot and label are fixed sizes
                        // in the CSS, so height only changes the stick.
                        html: landmarkMarkerHtml(h.label, size, h.color, h.label_color),
                        anchor: 'bottom center',
                        position: { yaw: `${h.yaw}deg`, pitch: `${h.pitch}deg` },
                        data: { hotspotDbId: h.id },
                    }
                }
                // Floor decal is a genuinely surface-embedded `imageLayer`
                // marker — a real 3D plane on the sphere, not a screen-
                // facing billboard like every other arrow type — placed as
                // a single point + a real 3-axis rotation object (confirmed
                // from PSV's own Marker3D source: rotation.yaw/pitch/roll
                // map to Y/X/Z axis rotation respectively, and the base
                // orientation before rotation is applied is the same
                // regardless of where on the sphere the marker sits, so a
                // given rotate_x/rotate_y/rotation value looks the same
                // everywhere). size/100 is PSV's own world-scale factor
                // against the fixed sphere radius — a genuinely different
                // unit than every other arrow type's screen-space pixel
                // size, and the raw 40-400 slider range reads as far too
                // small once actually rendered that way, so
                // FLOOR_SIZE_MULTIPLIER scales it up here (and nowhere the
                // raw draggable value itself is used, so the resize-handle
                // feel stays identical to every other type).
                if (h.arrow_type === 'floor') {
                    const arrow = ARROWS.find(a => a.type === 'floor')
                    return {
                        id: `hs_${h.id}`,
                        type: 'imageLayer',
                        imageLayer: arrow.gif,
                        position: { yaw: `${h.yaw}deg`, pitch: `${h.pitch}deg` },
                        size: { width: size * FLOOR_SIZE_MULTIPLIER, height: size * FLOOR_SIZE_MULTIPLIER },
                        rotation: {
                            yaw:  `${h.rotate_y ?? 0}deg`,
                            pitch: `${h.rotate_x ?? 90}deg`,
                            roll: `${h.rotation ?? 0}deg`,
                        },
                        data: { hotspotDbId: h.id },
                    }
                }
                const arrow = ARROWS.find(a => a.type === h.arrow_type) || ARROWS[0]
                // Pulse ring stays a plain billboard (see the pulse-vs-3D
                // tradeoff — a true 3D-embedded marker would freeze its
                // pulse animation to one static frame), but X/Y still get a
                // real visible effect here via a CSS transform on the
                // marker's own element: `transform` (unlike `rotate`, which
                // PSV's own 2D markers already use for Z, and `translate`,
                // which they use for position) is never touched by PSV's
                // marker code for this type, so it's free to use for a
                // perspective tilt without fighting PSV's own positioning.
                // It's a cosmetic tilt on a flat billboard, not genuine 3D
                // embedding — it won't warp with the actual camera angle the
                // way floor decal's real 3D plane does, but it does mean X/Y
                // aren't just inert numbers for this type.
                const tilt = h.arrow_type === 'pulse'
                    ? { style: { transform: `perspective(600px) rotateX(${h.rotate_x ?? 0}deg) rotateY(${h.rotate_y ?? 0}deg)` } }
                    : {}
                // 'custom' is a plain billboard exactly like every other
                // type here — the ONLY difference is which image URL it
                // renders, a user-uploaded one (hotspot_panel.jsx's Icon
                // image upload) instead of a fixed sprite, falling back to
                // the lib/arrows.js placeholder glyph until one's uploaded.
                return {
                    id: `hs_${h.id}`,
                    type: 'image',
                    image: h.custom_icon_url || arrow.gif,
                    size: { width: size, height: size },
                    position: { yaw: `${h.yaw}deg`, pitch: `${h.pitch}deg` },
                    rotation: `${h.rotation ?? 0}deg`,
                    tooltip: h.label || undefined,
                    data: { hotspotDbId: h.id },
                    ...tilt,
                }
            })

        const baseHfov = activeScene.initial_hfov ?? DEFAULT_HFOV
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

        // Zones. The one currently being corner-dragged (editingPolygonId) is
        // excluded here — its live shape is drawn separately, from
        // polygonPopup.points, in the JSX corner-handle overlay, so this
        // marker (still holding the pre-edit points) would otherwise sit
        // behind/beside it looking like a second, stale copy of the zone.
        const polygonMarkers = visiblePolygons
            .filter(p => p.id !== editingPolygonId)
            .map(p => {
                const c = colorForStatus(p.status, p.custom_color)
                return {
                    id: `poly_${p.id}`,
                    type: 'polygon',
                    polygon: p.points.map(([yaw, pitch]) => [`${yaw}deg`, `${pitch}deg`]),
                    svgStyle: { fill: c + '55', stroke: c, strokeWidth: '2' },
                    data: { polygonId: p.id },
                }
            })

        // The live drawing-preview line is NOT built here — it needs to
        // follow the cursor every frame (a rubber band from the last placed
        // point), which would mean rebuilding this entire arrows/cover-ups/
        // zones list on every mousemove if driven from this effect. It's
        // managed imperatively in mainLoop instead, the same way the
        // placement pin and selected cover-up already are.
        const next = [...coverupMarkers, ...polygonMarkers, ...arrowMarkers]
        try {
            mp.setMarkers(next)
        } catch {
            // Fallback if this PSV version lacks the bulk-replace method.
            mp.clearMarkers()
            for (const m of next) { try { mp.addMarker(m) } catch {} }
        }
    }, [hotspots, visibleCoverups, visiblePolygons, activeScene, hotspotSize, editingId, editingPolygonId, selectedOverlay, coverupAspect])

    // ── rAF — keeps the placement pin + selected cover-up projected on screen
    const mainLoop = useCallback(() => {
        // While the preview modal is open, stop projecting/setting state every
        // frame — it would re-render the editor (and the modal) needlessly.
        if (previewOpenRef.current) { rafRef.current = requestAnimationFrame(mainLoop); return }

        const viewer = psvRef.current
        const ps     = popupRef.current

        let pitch, yaw
        if (ps?.mode === 'new' || ps?.mode === 'edit-existing') { pitch = ps.pitch; yaw = ps.yaw }

        if (viewer && pitch != null && yaw != null) {
            try {
                const pt   = viewer.dataHelper.sphericalCoordsToViewerCoords({ yaw: yaw * RAD, pitch: pitch * RAD })
                // hfov rides along so the floor decal's edit-time drag box
                // (a flat DOM overlay) can be scaled the same way the
                // selected cover-up's already is (see coverupPopupScreen
                // below) — real 3D content's on-screen size changes with
                // zoom, but this box was a fixed pixel size regardless of
                // zoom, so it drifted out of sync with the actual decal the
                // moment you zoomed away from whatever level it happened to
                // be tuned to look right at.
                const hfov = viewer.dataHelper.zoomLevelToFov(viewer.getZoomLevel())
                setPinPos(pt ? { x: pt.x, y: pt.y, hfov } : null)
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

        const pp = polygonPopupRef.current

        // Corner-handle screen positions while editing a zone's shape — a
        // plain DOM/SVG overlay (not a PSV marker) projected fresh every
        // frame, same reasoning as the placement pin's own corner handles:
        // PSV markers can't be dragged natively, so the interactive bits
        // live in React-owned DOM instead.
        if (viewer && pp?.mode === 'edit' && pp.points?.length) {
            try {
                setPolygonVertexScreens(pp.points.map(([yaw, pitch]) => {
                    const pt = viewer.dataHelper.sphericalCoordsToViewerCoords({ yaw: yaw * RAD, pitch: pitch * RAD })
                    return pt ? { x: pt.x, y: pt.y } : null
                }))
            } catch { setPolygonVertexScreens([]) }
        } else if (polygonVertexScreensRef.current.length) {
            setPolygonVertexScreens([])
        }

        // Live rubber-band preview line while drawing a zone — a dashed line
        // from every placed point through to the current cursor position,
        // updated every frame so it visibly tracks the mouse between clicks
        // (not just between already-placed points). Managed imperatively
        // here rather than in the declarative marker-sync effect, which
        // would mean rebuilding the whole arrows/cover-ups/zones list on
        // every mousemove. updateMarker is tried first (cheap patch on an
        // existing marker); addMarker is the fallback for the first frame
        // after a point is placed, when the marker doesn't exist yet — self-
        // healing, so it doesn't matter if the marker-sync effect happens to
        // run in between and hand PSV a marker list that doesn't include it.
        //
        // The line's end point snaps the same way a click would (same
        // findSnapPoint, same candidates, same SNAP_PX) — hovering near an
        // existing vertex pulls the line onto it before you click, and
        // moving away past SNAP_PX releases it back to the raw cursor. This
        // has to stay in exact agreement with the click handler's own snap
        // check, or the preview would show one thing and clicking would do
        // another.
        const mp = markersPluginRef.current
        const dp = drawingPolygonRef.current
        if (viewer && mp && dp && dp.points.length >= 1 && drawCursorRef.current) {
            try {
                const el     = viewerRef.current
                const rect   = el.getBoundingClientRect()
                const screenX = drawCursorRef.current.x - rect.left
                const screenY = drawCursorRef.current.y - rect.top
                const sph    = viewer.dataHelper.viewerCoordsToSphericalCoords({ x: screenX, y: screenY })
                if (sph) {
                    const sceneId = viewerSceneIdRef.current
                    const candidates = [
                        ...polygonsRef.current.filter(p => p.scene_id === sceneId).flatMap(p => p.points),
                        ...dp.points,
                    ]
                    const snapped = findSnapPoint(viewer, candidates, screenX, screenY)
                    const cursorPoint = snapped || [sph.yaw * DEG, sph.pitch * DEG]
                    const markerCfg = {
                        id: 'poly_preview',
                        type: 'polyline',
                        polyline: [...dp.points, cursorPoint].map(([yaw, pitch]) => [`${yaw}deg`, `${pitch}deg`]),
                        svgStyle: { stroke: 'var(--editor-lime-400)', strokeWidth: '3', strokeDasharray: '4,2', fill: 'none' },
                    }
                    try { mp.updateMarker(markerCfg) } catch { try { mp.addMarker(markerCfg) } catch {} }
                }
            } catch {}
        } else if (mp && !dp) {
            try { mp.removeMarker('poly_preview') } catch {}
        }

        // Floor decal live preview while placing/editing — a REAL imageLayer
        // marker updated imperatively from popupState, not a flat CSS-
        // transform approximation. A true 3D rotation can't be faithfully
        // previewed that way: the marker's actual baseline orientation
        // (before any rotation is applied — see the arrowMarkers comment
        // below) is nothing like a flat, camera-facing icon's, so a modest-
        // looking slider change in a CSS preview could correspond to a
        // drastically different real result — exactly a "looks right while
        // editing, wrong after Save" bug. This is the one true source of
        // truth for what it'll actually look like.
        //
        // Only actually calls updateMarker when the values changed since
        // the last frame (floorPreviewKeyRef) — unlike the zone-drawing
        // preview line (a cheap SVG polyline), this is a real WebGL/three.js
        // object: updateMarker rebuilds its mesh transform AND fires a
        // set-markers event every single call, and doing that unconditionally
        // 60 times a second (even while nothing was actually being dragged)
        // was heavy enough to visibly flicker every OTHER marker in the
        // scene too, not just this one.
        const isFloorEdit = ps && (ps.mode === 'new' || ps.mode === 'edit-existing') && ps.arrow_type === 'floor'
        if (viewer && mp && isFloorEdit) {
            const size = ps.size ?? hotspotSizeRef.current
            const key  = `${ps.yaw}|${ps.pitch}|${size}|${ps.rotate_x ?? 90}|${ps.rotate_y ?? 0}|${ps.rotation ?? 0}`
            // The declarative marker-sync effect (editingId changing when
            // "Edit" is clicked, or any of its other deps) calls
            // mp.setMarkers() — a full clear-and-rebuild that doesn't know
            // about this imperative preview marker, so it silently wipes it
            // out whenever that effect happens to rerun after this frame's
            // add/update. Trusting the key comparison alone then means it's
            // never re-added, since from this code's perspective nothing
            // "changed" — exactly why the decal vanished after briefly
            // existing. Checking real existence every frame (not just
            // whether the inputs changed) makes this self-healing the same
            // way the poly_preview line already is.
            let exists = true
            try { mp.getMarker('hs_floor_preview') } catch { exists = false }
            if (!exists) floorPreviewKeyRef.current = null
            if (floorPreviewKeyRef.current !== key) {
                const arrow = ARROWS.find(a => a.type === 'floor')
                const floorCfg = {
                    id: 'hs_floor_preview',
                    type: 'imageLayer',
                    imageLayer: arrow.gif,
                    position: { yaw: `${ps.yaw}deg`, pitch: `${ps.pitch}deg` },
                    size: { width: size * FLOOR_SIZE_MULTIPLIER, height: size * FLOOR_SIZE_MULTIPLIER },
                    rotation: {
                        yaw:   `${ps.rotate_y ?? 0}deg`,
                        pitch: `${ps.rotate_x ?? 90}deg`,
                        roll:  `${ps.rotation ?? 0}deg`,
                    },
                }
                // Only recorded as "applied" once one of the two calls
                // actually succeeds — marking it applied unconditionally
                // (before knowing whether either call worked) meant a
                // failed FIRST attempt (e.g. right when entering edit mode,
                // before the marker exists yet) was never retried on later
                // frames, since the key would already "match" forever after
                // — exactly why the decal stayed invisible (only the DOM
                // bounding box showed) until Save handed off to the
                // declarative marker-sync effect instead.
                try { mp.updateMarker(floorCfg); floorPreviewKeyRef.current = key }
                catch {
                    try { mp.addMarker(floorCfg); floorPreviewKeyRef.current = key }
                    catch {}
                }
            }
        } else if (mp && !isFloorEdit) {
            if (floorPreviewKeyRef.current !== null) {
                floorPreviewKeyRef.current = null
                try { mp.removeMarker('hs_floor_preview') } catch {}
            }
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
            // "Hotspot N" instead of leaving it blank (which fell back to
            // literally "Untitled" everywhere it's displayed) — numbered
            // per scene, same "Zone N" auto-naming convention already used
            // for polygon zones. Read from refs (hotspotsRef/
            // viewerSceneIdRef), not `hotspots`/`activeScene` directly —
            // this callback's deps don't include either, so those would be
            // stale snapshots from whenever it was last recreated.
            //
            // Landmark gets its own "Landmark N" counter (numbered among
            // just the scene's other landmarks, not every hotspot type) —
            // it reads as a distinct kind of marker on canvas (stick+dot+
            // label), so a generic "Hotspot N" name felt mismatched.
            const sceneId = viewerSceneIdRef.current
            const sceneHotspots = hotspotsRef.current.filter(h => h.scene_id === sceneId)
            const label = hotspotType === 'landmark'
                ? `Landmark ${sceneHotspots.filter(h => h.arrow_type === 'landmark').length + 1}`
                : `Hotspot ${sceneHotspots.length + 1}`
            setPopupState({
                mode: 'new', arrow_type: hotspotType, ...coords, label, target_scene_id: '', size: null, rotation: 0,
                color: DEFAULT_HOTSPOT_COLOR, label_color: DEFAULT_LABEL_COLOR,
                // rotate_x defaults to 90 ONLY for floor, so a freshly-
                // placed floor decal starts lying flat, matching its old
                // locked-flat behavior, before the user tilts it further via
                // the sliders. Every other type (including pulse, which now
                // gives rotate_x/rotate_y a real visible CSS-tilt effect —
                // see the arrowMarkers builder) defaults to 0/0: rotate_x:90
                // on a flat billboard would render it perfectly edge-on
                // (invisible) the instant it's placed, the same "default
                // that vanishes" bug already hit and fixed for floor's own
                // edit-preview.
                rotate_x: hotspotType === 'floor' ? 90 : 0, rotate_y: 0,
                action_type: 'navigate', link_url: '', info_body: '', info_image_url: '', info_fields: [],
                toggle_target_id: '', start_hidden: false, animate_line: true,
                custom_icon_url: '',
            })
        }
    }, [sampleAt, drawingPolygon])

    // Corner-handle drag on the placement pin's bounding box. Same math
    // already proven for cover-ups (startOverlayResize/startOverlayRotate) —
    // center-anchored resize, absolute-angle rotate — just keyed off pinPos
    // (viewer-relative screen coords, refreshed every rAF frame by mainLoop)
    // instead of coverupPopupScreen, and writing into popupState instead of
    // patching a coverups array item.
    function startPinResize(e) {
        e.preventDefault(); e.stopPropagation()
        if (!pinPos || !viewerRef.current) return
        const rect = viewerRef.current.getBoundingClientRect()
        const cxPage = rect.left + pinPos.x
        const cyPage = rect.top  + pinPos.y
        pinGestureRef.current = {
            mode: 'resize', cxPage, cyPage,
            startSize: popupState.size ?? hotspotSize,
            startDist: Math.hypot(e.clientX - cxPage, e.clientY - cyPage),
        }
        setIsDraggingPin(true)
    }

    function startPinRotate(e) {
        e.preventDefault(); e.stopPropagation()
        if (!pinPos || !viewerRef.current) return
        const rect = viewerRef.current.getBoundingClientRect()
        pinGestureRef.current = {
            mode: 'rotate',
            cxPage: rect.left + pinPos.x,
            cyPage: rect.top  + pinPos.y,
        }
        setIsDraggingPin(true)
    }

    // Floor decal's 3-ring gizmo (one ring per axis) — same corner-drag
    // pattern as startPinResize/startPinRotate, but delta-based instead of
    // absolute-angle: with three overlapping rings you grab from wherever
    // that ring happens to be, so snapping straight to "wherever the cursor
    // currently is" (what the single Z-only handle above does) would jump
    // the instant you click down. Recording the start angle AND the axis's
    // current value lets onOverlayMouseMove apply only the swept delta.
    const AXIS_FIELD = { x: 'rotate_x', y: 'rotate_y', z: 'rotation' }
    function startAxisRotate(e, axis) {
        e.preventDefault(); e.stopPropagation()
        if (!pinPos || !viewerRef.current || !popupState) return
        const rect = viewerRef.current.getBoundingClientRect()
        const cxPage = rect.left + pinPos.x
        const cyPage = rect.top  + pinPos.y
        const field = AXIS_FIELD[axis]
        pinGestureRef.current = {
            mode: 'axisRotate', axis, field, cxPage, cyPage,
            startAngle: Math.atan2(e.clientY - cyPage, e.clientX - cxPage) * 180 / Math.PI,
            startValue: popupState[field] ?? (field === 'rotate_x' ? 90 : 0),
        }
        setIsDraggingPin(true)
    }

    const onOverlayMouseMove = useCallback(e => {
        if (!isDraggingPin) return

        const g = pinGestureRef.current
        if (g?.mode === 'resize') {
            const dist = Math.hypot(e.clientX - g.cxPage, e.clientY - g.cyPage)
            const newSize = Math.min(400, Math.max(40, g.startSize * (dist / g.startDist)))
            setPopupState(prev =>
                (prev?.mode === 'new' || prev?.mode === 'edit-existing') ? { ...prev, size: roundTo2(newSize) } : prev
            )
            return
        }
        if (g?.mode === 'rotate') {
            const angleDeg = Math.atan2(e.clientY - g.cyPage, e.clientX - g.cxPage) * 180 / Math.PI + 90
            const wrapped  = ((angleDeg + 180) % 360 + 360) % 360 - 180
            setPopupState(prev =>
                (prev?.mode === 'new' || prev?.mode === 'edit-existing') ? { ...prev, rotation: roundTo2(wrapped) } : prev
            )
            return
        }
        if (g?.mode === 'axisRotate') {
            const angleDeg = Math.atan2(e.clientY - g.cyPage, e.clientX - g.cxPage) * 180 / Math.PI
            const delta    = angleDeg - g.startAngle
            const wrapped  = ((g.startValue + delta + 180) % 360 + 360) % 360 - 180
            setPopupState(prev =>
                (prev?.mode === 'new' || prev?.mode === 'edit-existing') ? { ...prev, [g.field]: roundTo2(wrapped) } : prev
            )
            return
        }

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
            setActiveRightTab('overlays')
            return
        }
        startOverlayDrag(e, id)
    }

    function startOverlayDrag(e, id) {
        e.preventDefault(); e.stopPropagation()
        setSelectedOverlay(id)
        setDraggingOverlay(id)
        overlayGestureRef.current = null   // defensive: a move gesture never inherits a stale resize/rotate

        const logo = logos.find(l => l.id === id)
        const el   = viewerRef.current
        if (logo && el) {
            const rect = el.getBoundingClientRect()
            const cx = rect.left + (logo.x / 100) * rect.width
            const cy = rect.top  + (logo.y / 100) * rect.height
            logoDragRef.current = { offX: e.clientX - cx, offY: e.clientY - cy }
        }
    }

    // Corner-handle drag on the selected cover-up's bounding box. Center-
    // anchored (all 4 corners move symmetrically) — the only resize semantics
    // that doesn't also require recomputing pitch/yaw, since the data model
    // has one anchor point, not one per corner.
    function startOverlayResize(e, id) {
        e.preventDefault(); e.stopPropagation()
        const c = coverups.find(x => x.id === id)
        if (!c || !viewerRef.current || !coverupPopupScreen) return
        setSelectedOverlay(id)
        setDraggingOverlay(id)
        const rect = viewerRef.current.getBoundingClientRect()
        const cxPage = rect.left + coverupPopupScreen.x
        const cyPage = rect.top  + coverupPopupScreen.y
        overlayGestureRef.current = {
            mode: 'resize', id, cxPage, cyPage,
            startSize: c.size,
            startDist: Math.hypot(e.clientX - cxPage, e.clientY - cyPage),
        }
    }

    // Rotate-handle drag. Rotation is an absolute angle from box-center to the
    // cursor every move (not a delta) — the handle always sits at the box's
    // current "up" direction, so grabbing it and moving is jump-free.
    function startOverlayRotate(e, id) {
        e.preventDefault(); e.stopPropagation()
        if (!viewerRef.current || !coverupPopupScreen) return
        setSelectedOverlay(id)
        setDraggingOverlay(id)
        const rect = viewerRef.current.getBoundingClientRect()
        overlayGestureRef.current = {
            mode: 'rotate', id,
            cxPage: rect.left + coverupPopupScreen.x,
            cyPage: rect.top  + coverupPopupScreen.y,
        }
    }

    function onOverlayDragMove(e) {
        if (!draggingOverlay) return
        const el = viewerRef.current
        if (!el) return

        const g = overlayGestureRef.current
        if (g?.mode === 'resize') {
            const dist = Math.hypot(e.clientX - g.cxPage, e.clientY - g.cyPage)
            const newSize = Math.min(800, Math.max(24, g.startSize * (dist / g.startDist)))
            patchCoverup(g.id, { size: roundTo2(newSize) })
            return
        }
        if (g?.mode === 'rotate') {
            // Offset by +90deg so "handle straight up" = 0deg, matching CSS
            // rotate()'s clockwise-for-positive-theta convention exactly.
            const angleDeg = Math.atan2(e.clientY - g.cyPage, e.clientX - g.cxPage) * 180 / Math.PI + 90
            const wrapped  = ((angleDeg + 180) % 360 + 360) % 360 - 180
            patchCoverup(g.id, { rotation: roundTo2(wrapped) })
            return
        }

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
        overlayGestureRef.current = null
        // Position/size/rotation already live in state from the drag itself;
        // releasing just ends the gesture. Nothing is written until Save.
    }

    // ── API: create hotspot ────────────────────────────────────────────────
    async function saveHotspot() {
        if (popupState?.mode !== 'new' || !project) return
        // Re-entrancy guard — handleSave (and so this) can be triggered from
        // several independent places for what's really one user action: the
        // document-level click-away auto-save, the Escape key, Enter in the
        // Label field, and the header's own Save button. Two of those firing
        // in quick succession — e.g. dragging the placement box to reposition
        // it, then pressing Escape right as the mouseup's click-away also
        // registers — both read popupState.mode as 'new' before the first
        // POST's response lands and closes the popup, so both went ahead and
        // created a separate row: a genuine duplicate hotspot from one
        // placement. This flag makes every call after the first, while a
        // save is still in flight, a no-op.
        if (savingNewHotspotRef.current) return
        savingNewHotspotRef.current = true
        // Captured so the success handler can check it's still the SAME
        // in-progress popup before clearing it — auto-save-on-click-away
        // means this can now be triggered by the very click that opens a
        // DIFFERENT hotspot's edit popup. Without this check, this save's
        // response landing after that new popup opened would wipe it back
        // to null out from under the user.
        const savingFor = popupState
        dispatchFlag('savingHotspot')
        try {
            const res = await fetch('/api/hotspots', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({
                    project_id: project.id, scene_id: activeScene.id,
                    pitch: roundTo2(popupState.pitch), yaw: roundTo2(popupState.yaw),
                    arrow_type: popupState.arrow_type, label: popupState.label || '',
                    // '' (the <select>'s unset state) has to become null, not
                    // get sent as-is — Postgres rejects '' for a uuid column
                    // outright, it's not just "no link" the way null is.
                    target_scene_id: popupState.target_scene_id || null,
                    size: popupState.size, rotation: popupState.rotation, color: popupState.color,
                    label_color: popupState.label_color,
                    rotate_x: popupState.rotate_x, rotate_y: popupState.rotate_y,
                    action_type: popupState.action_type || 'navigate',
                    link_url: popupState.link_url || null, info_body: popupState.info_body || null,
                    info_image_url: popupState.info_image_url || null,
                    info_fields: popupState.info_fields || [],
                    toggle_target_id: popupState.toggle_target_id || null,
                    start_hidden: !!popupState.start_hidden,
                    animate_line: popupState.animate_line !== false,
                    custom_icon_url: popupState.custom_icon_url || null,
                }),
            })
            if (res.ok) {
                const { hotspot } = await res.json()
                setHotspots(prev => [...prev, hotspot])
                setPopupState(prev => prev === savingFor ? null : prev)
            }
        } finally { dispatchFlag('savingHotspot'); savingNewHotspotRef.current = false }
    }

    // ── API: update hotspot ────────────────────────────────────────────────
    async function updateHotspot() {
        if (popupState?.mode !== 'edit-existing') return
        const hotspotId = popupState.hotspot.id
        const savingFor = popupState // see saveHotspot's comment on this
        dispatchFlag('savingHotspot')
        try {
            const res = await fetch(`/api/hotspots/${hotspotId}`, {
                method: 'PATCH', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({
                    label:           popupState.label || '',
                    target_scene_id: popupState.target_scene_id || null,
                    pitch:           roundTo2(popupState.pitch),
                    yaw:             roundTo2(popupState.yaw),
                    arrow_type:      popupState.arrow_type,
                    size:            popupState.size,
                    rotation:        popupState.rotation,
                    color:           popupState.color,
                    label_color:     popupState.label_color,
                    rotate_x:        popupState.rotate_x,
                    rotate_y:        popupState.rotate_y,
                    action_type:      popupState.action_type || 'navigate',
                    link_url:         popupState.link_url || null,
                    info_body:        popupState.info_body || null,
                    info_image_url:   popupState.info_image_url || null,
                    info_fields:      popupState.info_fields || [],
                    toggle_target_id: popupState.toggle_target_id || null,
                    start_hidden:     !!popupState.start_hidden,
                    animate_line:     popupState.animate_line !== false,
                    custom_icon_url:  popupState.custom_icon_url || null,
                }),
            })
            if (res.ok) {
                const { hotspot } = await res.json()
                setHotspots(prev => prev.map(h => h.id === hotspot.id ? hotspot : h))
                setPopupState(prev => prev === savingFor ? null : prev)
            } else {
                const err = await res.json().catch(() => ({}))
                console.error('PATCH hotspot failed:', res.status, err?.error)
            }
        } finally { dispatchFlag('savingHotspot') }
    }

    // Returns the underlying save's promise (rather than being fire-and-
    // forget) so callers that need the save to actually land before moving
    // on — publishTour flushing a pending edit before it snapshots the
    // database — can await it.
    function handleSave() {
        if (popupState?.mode === 'new')           return saveHotspot()
        if (popupState?.mode === 'edit-existing') return updateHotspot()
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
        sessionPointsRef.current = []
        zoneNumberRef.current = polygonsRef.current.filter(p => p.scene_id === activeScene.id).length + 1
        setDrawingPolygon({ points: [] })
    }

    function cancelDrawingPolygon() {
        sessionPointsRef.current = []
        setDrawingPolygon(null)
    }

    // A loop closed by revisiting one of the current stroke's own points
    // (see the click handler) — saved immediately with no popup, matching a
    // paint-bucket fill: the boundary just closed, so that's a complete zone
    // right there. Same shape as a manual Finish + Save, minus the label
    // step; rename/edit it afterward from the panel like any other zone.
    async function saveAutoPolygon(points) {
        if (!project || !activeScene) return
        const label = `Zone ${zoneNumberRef.current}`
        zoneNumberRef.current += 1
        try {
            const res = await fetch('/api/polygons', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: project.id, scene_id: activeScene.id,
                    points, status: 'available', label, detail: {},
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) { setPolygonError(json.error || 'Could not save a zone.'); return }
            setPolygons(prev => [...prev, json.polygon])
            // Same landing spot as the Finish-button path (finishDrawingPolygon)
            // — straight into the new zone's edit form, not back to the list.
            setPolygonPopup(polygonEditState(json.polygon))
            setActiveRightTab('zones')
        } catch {
            setPolygonError('Network error — a zone was not saved.')
        }
    }

    // A shape's last edge already connects back to its first point
    // automatically — it never needed a literal closing point equal to point
    // 1 stored in the array. Some earlier-drawn zones have one anyway (from
    // before the corner-drag tool existed, when closing meant re-clicking
    // point 1 as an actual extra vertex), which put two drag handles exactly
    // on top of each other: dragging one visibly left the other behind.
    // Collapse that duplicate back into one point here, whenever a saved
    // zone is opened for editing — the next auto-save writes the deduped
    // version back and it stays fixed.
    function dedupedPoints(points) {
        let pts = points.map(([yaw, pitch]) => [yaw, pitch])
        if (pts.length > 3) {
            const [fy, fp] = pts[0]
            const [ly, lp] = pts[pts.length - 1]
            if (Math.abs(fy - ly) < 1e-6 && Math.abs(fp - lp) < 1e-6) pts = pts.slice(0, -1)
        }
        return pts
    }

    // The editable working copy of a saved zone — status/label/detail/points
    // all start as plain copies of the saved row, then diverge as the form
    // (or a corner drag) edits them; _dirty tracks whether anything actually
    // has, so opening a zone just to look at it doesn't fire a pointless
    // auto-save with unchanged values (see the auto-save effect below).
    function polygonEditState(p) {
        return {
            mode: 'edit', polygon: p,
            status: p.status, label: p.label, detail: p.detail, custom_color: p.custom_color || null,
            points: dedupedPoints(p.points), _dirty: false,
            edge_lengths: normalizeEdgeLengths(p.edge_lengths, dedupedPoints(p.points).length),
            action_type: p.action_type || 'info',
            target_scene_id: p.target_scene_id || '',
            link_url: p.link_url || '', info_body: p.info_body || '', info_image_url: p.info_image_url || '',
            info_fields: p.info_fields || [],
            toggle_target_id: p.toggle_target_id || '', start_hidden: !!p.start_hidden,
        }
    }

    // Closes (or switches to a different) zone popup, flushing any dirty,
    // not-yet-auto-saved edit first — without this, closing/switching within
    // the debounce window (see the auto-save effect) would silently drop
    // the last few edits: the effect's cleanup cancels the pending timer as
    // soon as polygonPopup changes, so nothing would ever fire it.
    function closePolygonPopup(nextState = null) {
        clearTimeout(polygonSaveTimerRef.current)
        if (polygonPopup?.mode === 'edit' && polygonPopup._dirty) updatePolygon()
        setPolygonPopup(nextState)
    }

    // Debounced auto-save — no more explicit Save/Finish button. Waits for a
    // pause in editing (typing, picking a status, dragging a corner) rather
    // than saving on every keystroke/frame; dirty gates it so merely opening
    // a zone to look at it never fires a no-op PATCH with unchanged values.
    useEffect(() => {
        if (!polygonPopup || polygonPopup.mode !== 'edit' || !polygonPopup._dirty) return
        clearTimeout(polygonSaveTimerRef.current)
        polygonSaveTimerRef.current = setTimeout(() => { updatePolygon() }, 700)
        return () => clearTimeout(polygonSaveTimerRef.current)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        polygonPopup?._dirty, polygonPopup?.label, polygonPopup?.status, polygonPopup?.detail, polygonPopup?.points,
        polygonPopup?.custom_color, polygonPopup?.edge_lengths?.join('|'),
        polygonPopup?.action_type, polygonPopup?.target_scene_id, polygonPopup?.link_url,
        polygonPopup?.info_body, polygonPopup?.info_image_url, polygonPopup?.toggle_target_id, polygonPopup?.start_hidden,
        polygonPopup?.info_fields,
    ])

    async function finishDrawingPolygon() {
        if (!drawingPolygon || drawingPolygon.points.length < 3 || !project || !activeScene) return
        const label = `Zone ${zoneNumberRef.current}`
        zoneNumberRef.current += 1
        const points = drawingPolygon.points
        setDrawingPolygon(null)
        setPolygonError('')
        try {
            const res = await fetch('/api/polygons', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: project.id, scene_id: activeScene.id,
                    points, status: 'available', label, detail: {},
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setPolygonError(json.error || 'Could not save the zone.')
                setDrawingPolygon({ points }) // keep the shape so Finish can be retried, not lost
                return
            }
            setPolygons(prev => [...prev, json.polygon])
            setPolygonPopup(polygonEditState(json.polygon))
            setActiveRightTab('zones')
            lastVertexRef.current = null
        } catch {
            setPolygonError('Network error — a zone was not saved.')
            setDrawingPolygon({ points })
        }
    }

    async function updatePolygon() {
        if (polygonPopup?.mode !== 'edit' || !polygonPopup.polygon) return
        const savingFor = polygonPopup
        setSavingPolygon(true)
        setPolygonError('')
        try {
            const res = await fetch(`/api/polygons/${savingFor.polygon.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: savingFor.status, label: savingFor.label, detail: savingFor.detail,
                    custom_color: savingFor.custom_color || null,
                    edge_lengths: savingFor.edge_lengths || [],
                    points: savingFor.points,
                    action_type: savingFor.action_type || 'info',
                    target_scene_id: savingFor.target_scene_id || null,
                    link_url: savingFor.link_url || null, info_body: savingFor.info_body || null,
                    info_image_url: savingFor.info_image_url || null,
                    info_fields: savingFor.info_fields || [],
                    toggle_target_id: savingFor.toggle_target_id || null,
                    start_hidden: !!savingFor.start_hidden,
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) { setPolygonError(json.error || 'Could not save the zone.'); return }
            setPolygons(prev => prev.map(p => p.id === json.polygon.id ? json.polygon : p))
            // Still editing the SAME zone (not one closePolygonPopup already
            // moved on from while this request was in flight) — merge the
            // saved row back in and clear dirty, but stay open: auto-save
            // never closes the form on its own, only an explicit close does.
            setPolygonPopup(prev => prev === savingFor ? { ...prev, polygon: json.polygon, _dirty: false } : prev)
            // Brief "Saved" confirmation — typing alone (cursor still
            // blinking) reads as ambiguous, so auto-save reports its own
            // success rather than leaving it to be inferred.
            clearTimeout(polygonSavedFlashTimerRef.current)
            setJustSavedPolygon(true)
            polygonSavedFlashTimerRef.current = setTimeout(() => setJustSavedPolygon(false), 1600)
        } catch {
            setPolygonError('Network error — the zone was not saved.')
        } finally {
            setSavingPolygon(false)
        }
    }

    // The zone form's explicit Save button — same "commit and go back to the
    // list" shape as the hotspot form's Save, layered on top of the auto-save
    // that already runs in the background: flush whatever's pending right
    // now (don't wait on the debounce) and close once it lands, rather than
    // requiring a separate click just to leave.
    async function saveZoneNow() {
        clearTimeout(polygonSaveTimerRef.current)
        await updatePolygon()
        closePolygonPopup()
    }

    // Corner-handle drag on a zone being edited — same shape as the hotspot
    // pin's drag (a full-screen capture div feeds mousemove here while
    // isDraggingVertex is set), but per-vertex: which corner moves is fixed
    // for the whole gesture (vertexDragRef), and every move just re-samples
    // the cursor's own sphere position for that one point — no resize/rotate
    // math, a corner just goes wherever the cursor is.
    function startVertexDrag(e, index) {
        e.preventDefault(); e.stopPropagation()
        vertexDragRef.current = index
        setIsDraggingVertex(true)
    }

    const onVertexDragMove = useCallback(e => {
        const index = vertexDragRef.current
        if (index == null) return
        const coords = sampleAt(e.clientX, e.clientY)
        if (!coords) return
        setPolygonPopup(prev => {
            if (prev?.mode !== 'edit') return prev
            const points = prev.points.map((pt, i) => i === index ? [coords.yaw, coords.pitch] : pt)
            return { ...prev, points, _dirty: true }
        })
    }, [sampleAt])

    function endVertexDrag() {
        vertexDragRef.current = null
        setIsDraggingVertex(false)
    }

    // Panel row click / re-click toggles the zone's form, same affordance as
    // the overlay panel's rows — straight into the editable form, no
    // separate read-only "view" step in between.
    function selectPolygon(id) {
        if (polygonPopup?.polygon?.id === id) { closePolygonPopup(); return }
        const p = polygons.find(x => x.id === id)
        if (!p) return
        closePolygonPopup(polygonEditState(p))
    }

    // Opens the confirmation modal (below, near hotspotToDelete's) rather
    // than deleting immediately — same "ask first" rule the hotspot list's
    // trash icon already followed; the zone form's own Delete button and
    // the list row's trash icon both route through this now instead of
    // calling deletePolygon directly.
    function requestDeletePolygon(id) {
        setPolygonToDelete(polygons.find(p => p.id === id) || { id })
    }

    async function deletePolygon(id) {
        clearTimeout(polygonSaveTimerRef.current)
        setDeletingPolygon(true)
        try {
            await fetch(`/api/polygons/${id}`, { method: 'DELETE' })
            setPolygons(prev => prev.filter(p => p.id !== id))
            if (polygonPopup?.polygon?.id === id) setPolygonPopup(null)
        } finally {
            setDeletingPolygon(false)
        }
    }

    async function confirmDeletePolygon() {
        if (!polygonToDelete) return
        await deletePolygon(polygonToDelete.id)
        setPolygonToDelete(null)
    }

    // Captures wherever you've currently panned/zoomed to and saves it as this
    // scene's opening view. The column and PATCH /api/scenes/[id] support have
    // existed since the start; this is the first thing that actually calls it.
    async function saveCurrentViewAsOpening() {
        const viewer = psvRef.current
        if (!viewer || !activeScene) return
        setSavingView(true)
        try {
            const pos  = viewer.getPosition()
            const hfov = viewer.dataHelper.zoomLevelToFov(viewer.getZoomLevel())
            const res = await fetch(`/api/scenes/${activeScene.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    initial_yaw:   roundTo2(pos.yaw   * DEG),
                    initial_pitch: roundTo2(pos.pitch * DEG),
                    initial_hfov:  roundTo2(hfov),
                }),
            })
            if (res.ok) {
                const { scene: updated } = await res.json()
                // Same scene id, so the viewer-init/marker-sync effects that
                // depend on activeScene see their guard hold and don't
                // re-initialize the viewer — they just pick up the new saved
                // angle for next time this scene is opened.
                setScenes(prev => prev.map(s => s.id === updated.id ? updated : s))
                setActiveScene(updated)
                setSavedViewTick(true)
                setTimeout(() => setSavedViewTick(false), 1800)
            }
        } catch {}
        finally { setSavingView(false) }
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

    // A hotspot/zone's own save only fires on an explicit action (click
    // away, Escape, the Save button — or, for a zone, ~700ms after you stop
    // editing it). Building the preview straight from `hotspots`/`polygons`
    // meant a hotspot placed right before hitting Preview — with no
    // intervening click-away — simply wasn't in that array yet, so it
    // silently didn't appear, while a zone (which auto-saves almost
    // immediately) usually already had. Rather than forcing a real network
    // save just to preview (Preview never needs to touch the database),
    // this overlays whatever's still sitting in the open popup on top of
    // the saved arrays — the exact same field shapes saveHotspot/
    // updateHotspot/updatePolygon already send the API, so no translation
    // needed. Purely local and synchronous: no stale-ref-after-setState risk.
    function openPreview() {
        if (!scenes.length || !project) return
        previewOpenRef.current = true

        let previewHotspots = hotspots
        if (popupState?.mode === 'new' && activeScene) {
            previewHotspots = [...hotspots, { id: '__preview_new_hotspot__', scene_id: activeScene.id, ...popupState }]
        } else if (popupState?.mode === 'edit-existing') {
            previewHotspots = hotspots.map(h => h.id === popupState.hotspot.id ? { ...h, ...popupState } : h)
        }

        let previewPolygons = polygons
        if (polygonPopup?.mode === 'edit') {
            previewPolygons = polygons.map(p => p.id === polygonPopup.polygon.id ? { ...p, ...polygonPopup } : p)
        }

        setPreviewHtml(buildTourHtml({ project, scenes, hotspots: previewHotspots, polygons: previewPolygons }))
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
            // Same reasoning, for a hotspot/zone edit still sitting in its
            // open form — a hotspot's own save only fires on an explicit
            // click-away/Escape/Save, not automatically, so one placed right
            // before hitting Publish would otherwise be silently missing
            // from the live tour (Preview's own version of this bug is
            // handled differently — see openPreview — since it can just
            // overlay the pending edit locally instead of needing a real
            // save; Publish snapshots the database, so it actually has to
            // land first).
            if (popupState?.mode === 'new' || popupState?.mode === 'edit-existing') await handleSave()
            if (polygonPopup?.mode === 'edit' && polygonPopup._dirty) await updatePolygon()

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

    // ── Download as a self-hostable zip ────────────────────────────────────
    // The API route reads live from scenes/hotspots/polygons (same as
    // Publish), so any edit still sitting in an open, unsaved form has to be
    // flushed first — identical reasoning to publishTour's own flush above.
    async function downloadZip() {
        if (!scenes.length || !project || downloadingZip) return
        setZipError('')
        setDownloadingZip(true)
        try {
            if (dirtyLogos || dirtyCoverups) {
                const ok = await saveOverlays()
                if (!ok) { setZipError('Your overlay changes could not be saved, so the zip was not built.'); return }
            }
            if (popupState?.mode === 'new' || popupState?.mode === 'edit-existing') await handleSave()
            if (polygonPopup?.mode === 'edit' && polygonPopup._dirty) await updatePolygon()

            // POST, not GET — this spends a credit (see the route's own
            // comment for why: nothing stops a downloaded zip being reused
            // outside this app, so each portable copy costs something).
            const res = await fetch(`/api/projects/${project.id}/export-zip`, { method: 'POST' })
            if (!res.ok) {
                const json = await res.json().catch(() => ({}))
                setZipError(json.error || 'Could not build the zip.')
                return
            }
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${(project.name || 'tour').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tour'}.zip`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
        } catch {
            setZipError('Network error — the zip was not built.')
        } finally { setDownloadingZip(false) }
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

    // ── 1-year publishing window (see lib/publish-cycle.js) ────────────────
    // publish_cycle_started_at is set once, on the tour's very first publish
    // — null means "never published", which is never expired (nothing to
    // renew yet). hostingEndsAt is only meaningful once it's non-null.
    const hostingExpired = isPublishCycleExpired(project?.publish_cycle_started_at)
    const hostingEndsAt  = publishCycleEndsAt(project?.publish_cycle_started_at)

    async function renewProject() {
        if (!project || renewing) return
        setRenewError('')
        setRenewing(true)
        try {
            const res  = await fetch(`/api/projects/${project.id}/renew`, { method: 'POST' })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) { setRenewError(json.error || 'Could not renew.'); return }
            setProject(p => p ? { ...p, publish_cycle_started_at: json.publish_cycle_started_at } : p)
        } catch {
            setRenewError('Network error — the tour was not renewed.')
        } finally { setRenewing(false) }
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
        <div className="h-screen flex items-center justify-center bg-editor-canvas">
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
            <div className="h-screen flex flex-col bg-editor-canvas overflow-hidden">

                {/* ── Top bar ── */}
                <header className="h-[52px] flex items-center px-5 gap-3 border-b border-editor-border bg-white shrink-0 z-10">
                    <Link href="/360editor" className="flex items-center gap-1.5 text-editor-ink-muted hover:text-editor-ink transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                        <span className="text-[12px] font-medium">Dashboard</span>
                    </Link>
                    <span className="text-editor-border">/</span>
                    <div className="flex items-center gap-2 mr-auto">
                        <div className="w-6 h-6 bg-editor-primary rounded-md flex items-center justify-center shrink-0">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                            </svg>
                        </div>
                        <span className="text-editor-ink font-semibold text-[14px] truncate">{project?.name}</span>
                    </div>
                    {activeScene && <span className="text-[12px] text-editor-ink-muted truncate hidden sm:block">{activeScene.name}</span>}

                    {/* Settings */}
                    <button
                        onClick={() => { setSettingsDraft({ show_intro: project?.show_intro??true, auto_rotate: project?.auto_rotate??-3 }); setShowSettings(true) }}
                        title="Project settings"
                        className="flex items-center justify-center w-8 h-8 rounded-lg border border-editor-border text-editor-ink-muted hover:bg-editor-subtle transition-colors shrink-0">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                    </button>

                    {/* Delete */}
                    <button onClick={() => setConfirmDelete(true)} title="Delete project"
                            className="flex items-center justify-center w-8 h-8 rounded-lg border border-editor-border text-editor-ink-muted hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
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
                            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-editor-border text-editor-ink-muted text-[12px] font-medium hover:bg-editor-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                        Preview
                    </button>

                    {/* Download zip — a self-hostable copy: this same HTML plus
                        every image it references, bundled under /assets and
                        rewritten to point at them, so it runs on any static
                        host with no dependency on this app staying up. */}
                    <button onClick={downloadZip} disabled={downloadingZip || !scenes.length}
                            title="Download a self-hostable .zip (HTML + all images) — upload it anywhere. Costs 1 credit per download."
                            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-editor-border text-editor-ink-muted text-[12px] font-medium hover:bg-editor-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
                        {downloadingZip
                            ? <><Spinner/>Building…</>
                            : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download zip</>}
                    </button>

                    {/* Publish — creates (or refreshes) the permanent public link */}
                    <button onClick={publishTour} disabled={flags.publishing || !scenes.length || hostingExpired}
                            title={hostingExpired ? "This tour's 1-year hosting window has ended — renew it below to publish again" : (publicUrl ? 'Push the current version to the live link' : 'Host this tour on a permanent public link')}
                            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-editor-primary text-white text-[12px] font-semibold hover:bg-editor-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
                        {flags.publishing
                            ? <><Spinner/>{publicUrl ? 'Updating…' : 'Publishing…'}</>
                            : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><polyline points="8 7 12 3 16 7"/><line x1="12" y1="3" x2="12" y2="15"/></svg>{publicUrl ? 'Update live tour' : 'Publish'}</>}
                    </button>
                </header>

                {/* ── Hosting-expired alert — the public link now serves "not
                    available" to visitors (see lib/publish-cycle.js); only a
                    renewal (1 credit) resets the 1-year window and brings it
                    back. Shown above the live-link bar so it's the first
                    thing noticed, not buried among the other controls. */}
                {hostingExpired && (
                    <div className="flex items-center gap-2 px-5 py-2 border-b border-red-200 bg-red-50 shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-500 shrink-0"><path d="M12 8v5M12 16h.01"/><circle cx="12" cy="12" r="10"/></svg>
                        <span className="text-[12px] font-medium text-red-700">
                            This tour's 1-year hosting window has ended — visitors now see "not available".
                        </span>
                        <button onClick={renewProject} disabled={renewing}
                                className="ml-auto flex items-center gap-1.5 h-7 px-3 rounded-lg bg-red-600 text-white text-[11.5px] font-semibold hover:bg-red-700 disabled:opacity-40 transition-colors shrink-0">
                            {renewing ? <><Spinner size={11}/>Renewing…</> : 'Renew (2 credits)'}
                        </button>
                    </div>
                )}
                {renewError && <ErrorBanner message={renewError} onDismiss={() => setRenewError('')}/>}

                {/* ── Live link bar — appears once the tour has been published ── */}
                {publicUrl && (
                    <div className="h-9 flex items-center gap-2 px-5 border-b border-editor-border bg-editor-subtle shrink-0">
                        <span className={`flex items-center gap-1.5 text-[11px] font-semibold shrink-0 ${hostingExpired ? 'text-red-600' : 'text-emerald-700'}`}
                              title={hostingExpired ? undefined : (hostingEndsAt ? `Hosting active until ${hostingEndsAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : undefined)}>
                            <span className={`w-1.5 h-1.5 rounded-full ${hostingExpired ? 'bg-red-500' : 'bg-emerald-500'}`}/>
                            {hostingExpired ? 'Expired' : 'Live'}
                        </span>
                        <a href={openUrl()} target="_blank" rel="noreferrer"
                           className="text-[12px] text-editor-primary hover:underline truncate font-medium">
                            {publicUrl.replace(/^https?:\/\//, '')}
                        </a>
                        <button onClick={copyLink}
                                className="ml-auto flex items-center gap-1 h-6 px-2 rounded-lg border border-editor-border bg-white text-[11px] font-medium text-editor-ink-muted hover:text-editor-ink transition-colors shrink-0">
                            {copied
                                ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
                                : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy link</>}
                        </button>
                        <button onClick={() => setShowEmbedModal(true)}
                                title="Get an <iframe> snippet a client can paste into their own site"
                                className="flex items-center gap-1 h-6 px-2 rounded-lg border border-editor-border bg-white text-[11px] font-medium text-editor-ink-muted hover:text-editor-ink transition-colors shrink-0">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>Embed
                        </button>
                        <a href={openUrl()} target="_blank" rel="noreferrer"
                           className="flex items-center gap-1 h-6 px-2 rounded-lg border border-editor-border bg-white text-[11px] font-medium text-editor-ink-muted hover:text-editor-ink transition-colors shrink-0">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Open
                        </a>
                        <button onClick={unpublishTour} disabled={flags.unpublishing}
                                title="Take the tour offline (the link is kept and can be restored)"
                                className="flex items-center gap-1 h-6 px-2 rounded-lg border border-editor-border bg-white text-[11px] font-medium text-editor-ink-muted hover:border-red-300 hover:text-red-500 disabled:opacity-40 transition-colors shrink-0">
                            {flags.unpublishing ? <Spinner size={11}/> : 'Unpublish'}
                        </button>
                    </div>
                )}

                {publishError && <ErrorBanner message={publishError} onDismiss={() => setPublishError('')}/>}
                {overlayError && <ErrorBanner message={overlayError} onDismiss={() => setOverlayError('')}/>}
                {polygonError && <ErrorBanner message={polygonError} onDismiss={() => setPolygonError('')}/>}
                {zipError && <ErrorBanner message={zipError} onDismiss={() => setZipError('')}/>}

                {/* ── Body ── */}
                <div className="flex-1 flex overflow-hidden">

                    {/* Left — scenes */}
                    {leftPanelOpen && (
                        <div className="w-[180px] shrink-0 relative overflow-hidden">
                            <ScenePanel projectId={projectId} scenes={scenes}
                                        activeSceneId={activeScene?.id}
                                        onSelectScene={setActiveScene}
                                        onScenesChange={updated => { setScenes(updated); if (!activeScene && updated.length) setActiveScene(updated[0]) }}/>
                        </div>
                    )}

                    {/* Hide/show toggle — collapses the scene list entirely
                        rather than letting it be dragged narrower/wider. A
                        small floating pill straddling the panel boundary
                        (not a full-height bar) — the same collapse-button
                        pattern Notion/VS Code use. */}
                    <div className="relative w-0 shrink-0 z-20">
                        <button onClick={() => setLeftPanelOpen(o => !o)}
                                title={leftPanelOpen ? 'Hide scene list' : 'Show scene list'}
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-11 rounded-full
                                           border border-editor-border bg-white shadow-[0_1px_4px_rgba(0,0,0,0.1)]
                                           text-editor-icon-idle hover:border-editor-primary hover:bg-editor-primary
                                           hover:text-white transition-colors flex items-center justify-center">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                                {leftPanelOpen ? <path d="M15 18l-6-6 6-6"/> : <path d="M9 18l6-6-6-6"/>}
                            </svg>
                        </button>
                    </div>

                    {/* Middle — viewer */}
                    <div className="flex-1 relative overflow-hidden bg-editor-subtle">
                        {!activeScene ? (
                            <div className={`absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed transition-colors ${isDragOver ? 'border-editor-primary bg-editor-primary/5' : 'border-editor-border'}`}
                                 onDragOver={onViewerDragOver} onDragLeave={() => setIsDragOver(false)} onDrop={onViewerDrop}>
                                <div className="w-16 h-16 bg-editor-primary/8 rounded-2xl flex items-center justify-center mb-4">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--editor-indigo-700)" strokeWidth="1.5">
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                                    </svg>
                                </div>
                                <p className="text-[14px] font-semibold text-editor-ink">
                                    {scenes.length ? 'No scene open' : 'Drop a scene here'}
                                </p>
                                <p className="text-[12px] text-editor-ink-muted mt-1">
                                    {scenes.length ? 'Drag a scene onto here, or double-click one to open it' : 'Drag an image from the left panel'}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div ref={viewerRef}
                                     className={`absolute inset-0 ${isDragOver ? 'ring-2 ring-editor-primary ring-inset' : ''}`}
                                     onDragOver={onViewerDragOver} onDragLeave={() => setIsDragOver(false)} onDrop={onViewerDrop}/>

                                {/* ── Selected cover-up — the only one rendered as plain DOM.
                                    Every other cover-up is a PSV marker (see the marker-sync
                                    effect); PSV has no native marker-dragging, so the one being
                                    pointed at swaps to a draggable element, exactly the pattern
                                    already used for hotspot placement below. */}
                                {selectedCoverup && coverupPopupScreen && (() => {
                                    const c = selectedCoverup
                                    const zoom = (activeScene.initial_hfov ?? DEFAULT_HFOV) / (coverupPopupScreen.hfov || activeScene.initial_hfov || DEFAULT_HFOV)
                                    const editing = editOverlay === c.id
                                    const w = c.size * zoom
                                    // Falls back to a square until this cover-up's preload effect
                                    // (~line 351) resolves its true aspect ratio — same fallback the
                                    // marker-sync effect already uses, so it self-heals on the next
                                    // render with no lasting distortion.
                                    const h = w * (coverupAspect[c.id] ?? 1)
                                    return (
                                        <div className="absolute z-10" style={{ left: coverupPopupScreen.x, top: coverupPopupScreen.y, transform: 'translate(-50%,-50%)' }}>
                                            <div style={{ width: w, height: h, position: 'relative', transform: `rotate(${c.rotation}deg)`, transformOrigin: 'center center' }}>
                                                <img
                                                    src={c.url}
                                                    alt=""
                                                    draggable={false}
                                                    onMouseDown={e => { if (editing) startOverlayDrag(e, c.id) }}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        opacity: c.opacity,
                                                        outline: `2px ${editing ? 'solid' : 'dashed'} var(--editor-indigo-700)`,
                                                        outlineOffset: '2px',
                                                        display: 'block',
                                                    }}
                                                    className={`select-none ${editing ? (draggingOverlay === c.id ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-pointer'}`}
                                                />
                                                {editing && (
                                                    <>
                                                        {/* Corner resize handles — center-anchored, uniform (the data model has one size scalar) */}
                                                        <div onMouseDown={e => startOverlayResize(e, c.id)}
                                                             className="absolute w-2.5 h-2.5 bg-white border-2 border-editor-primary rounded-sm cursor-nwse-resize"
                                                             style={{ left: 0, top: 0, transform: 'translate(-50%,-50%)', zIndex: 2 }}/>
                                                        <div onMouseDown={e => startOverlayResize(e, c.id)}
                                                             className="absolute w-2.5 h-2.5 bg-white border-2 border-editor-primary rounded-sm cursor-nesw-resize"
                                                             style={{ left: '100%', top: 0, transform: 'translate(-50%,-50%)', zIndex: 2 }}/>
                                                        <div onMouseDown={e => startOverlayResize(e, c.id)}
                                                             className="absolute w-2.5 h-2.5 bg-white border-2 border-editor-primary rounded-sm cursor-nesw-resize"
                                                             style={{ left: 0, top: '100%', transform: 'translate(-50%,-50%)', zIndex: 2 }}/>
                                                        <div onMouseDown={e => startOverlayResize(e, c.id)}
                                                             className="absolute w-2.5 h-2.5 bg-white border-2 border-editor-primary rounded-sm cursor-nwse-resize"
                                                             style={{ left: '100%', top: '100%', transform: 'translate(-50%,-50%)', zIndex: 2 }}/>
                                                        {/* Rotate handle */}
                                                        <div className="absolute pointer-events-none"
                                                             style={{ left: '50%', top: -28, width: 1, height: 28, borderLeft: '1px solid var(--editor-indigo-700)' }}/>
                                                        <div onMouseDown={e => startOverlayRotate(e, c.id)}
                                                             className="absolute w-3 h-3 bg-white border-2 border-editor-primary rounded-full"
                                                             style={{ left: '50%', top: -28, transform: 'translate(-50%,-50%)', zIndex: 2, cursor: ROTATE_CURSOR }}/>
                                                    </>
                                                )}
                                            </div>
                                            {!draggingOverlay && (
                                                <OverlayPopup item={c} kind="coverup"
                                                              editing={editing}
                                                              screenPos={coverupPopupScreen}
                                                              halfW={w / 2} halfH={h / 2}
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
                                                    outline: sel ? `2px ${editOverlay === l.id ? 'solid' : 'dashed'} var(--editor-indigo-700)` : 'none',
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
                                         onMouseUp={() => { setIsDraggingPin(false); pinGestureRef.current = null }}
                                         onMouseLeave={() => { setIsDraggingPin(false); pinGestureRef.current = null }}/>
                                )}

                                {/* While editing/placing: the draggable handle IS the real
                                    arrow image (same gif the exported tour uses) — WYSIWYG,
                                    no crosshair/pointer. Wrapped in a sized/rotated box with
                                    corner+rotate handles, same pattern as the cover-up bounding
                                    box — arrows are always square so there's no aspect-ratio
                                    tracking to do here, unlike cover-ups. */}
                                {hasPopup && isEditing && pinPos && (() => {
                                    const size = popupState.size ?? hotspotSize
                                    // Rotation is never applied to a landmark's own preview — the
                                    // real marker never reads it either (a vertical line rotating
                                    // in the screen plane doesn't mean anything), so rotating this
                                    // WYSIWYG preview box would show something the saved marker
                                    // never actually renders. The rotate handle stays active
                                    // regardless (no special-casing the drag math itself) — its
                                    // value is just harmlessly unused for this type.
                                    const isLandmark = popupState.arrow_type === 'landmark'
                                    const isFloor    = popupState.arrow_type === 'floor'
                                    const isPulse    = popupState.arrow_type === 'pulse'
                                    // Pulse ring stays a plain billboard (see the earlier tradeoff:
                                    // a true 3D-embedded marker would freeze its pulse animation to
                                    // one static frame) — it doesn't get floor's other special
                                    // treatment below (invisible drag target, shrunk/zoom-scaled box,
                                    // live imageLayer preview), just the SAME 3-ring gizmo UI/drag
                                    // interaction instead of the plain single Z-only dot. X/Y DO give
                                    // a real visible effect for pulse — a CSS perspective tilt, same
                                    // formula as the saved marker's own `style.transform` (see the
                                    // arrowMarkers builder) — it's cosmetic (a flat billboard doesn't
                                    // actually warp with camera angle the way floor's real 3D plane
                                    // does), but it's not just an inert number either.
                                    const showGizmo = isFloor || isPulse
                                    const rot = isLandmark || isFloor ? 0 : (popupState.rotation ?? 0)
                                    // Floor decal's real look (a true 3D-rotated plane) is shown by
                                    // an actual imageLayer marker, live-updated every frame straight
                                    // from popupState (see mainLoop's 'hs_floor_preview' block) — a
                                    // flat CSS 3D transform here was tried and abandoned: its
                                    // baseline orientation doesn't match the real marker's (three.js
                                    // aims the plane relative to the sphere, not straight at a fixed
                                    // CSS camera), so a modest-looking slider change in the CSS
                                    // approximation could correspond to a drastically different real
                                    // result — the exact "looks right while editing, wrong after
                                    // Save" bug that preview was supposed to prevent. This box is
                                    // now just an (invisible) drag/resize/rotate handle target.
                                    //
                                    // Pulse has no such conflict — its saved marker's tilt IS this
                                    // same CSS formula (not a different 3D engine), so previewing it
                                    // this way can't disagree with the real result the way it did
                                    // for floor.
                                    const boxTransform = isFloor
                                        ? 'none'
                                        : isPulse
                                            ? `perspective(600px) rotateX(${popupState.rotate_x ?? 0}deg) rotateY(${popupState.rotate_y ?? 0}deg) rotate(${rot}deg)`
                                            : `rotate(${rot}deg)`
                                    // `size` for floor isn't a screen-space pixel count like every
                                    // other type — it's a 3D scale factor (size/100, times
                                    // FLOOR_SIZE_MULTIPLIER — see arrowMarkers/mainLoop) against the
                                    // fixed sphere radius, rendered as a foreshortened plane, not a
                                    // size-px flat sprite. This box is purely an invisible drag/
                                    // resize/rotate hit target (see boxTransform above) — the real
                                    // look comes from the live 'hs_floor_preview' 3D marker — but its
                                    // size still has to roughly track that real decal, because it's
                                    // what the corner handles and gizmo rings are drawn around, and
                                    // because startPinResize's startDist (the corner handle's
                                    // distance from center at mousedown) is what the resize ratio
                                    // (dist / startDist) is relative to: too small a box makes a tiny
                                    // mouse move saturate the 40-400 clamp instantly (the earlier
                                    // "starts tiny, barely enlarges before maxing out" bug), too big
                                    // a box (plain `size`, unscaled) makes the handles balloon far
                                    // outside the actual decal's footprint. There's no single correct
                                    // conversion (real projected size depends on zoom/distance/angle
                                    // too), so 0.25 * FLOOR_SIZE_MULTIPLIER is a tuned empirical
                                    // factor — same as before FLOOR_SIZE_MULTIPLIER existed, just
                                    // scaled up to match the now-bigger real decal.
                                    //
                                    // zoomScale corrects for the OTHER half of that: real 3D content
                                    // (the actual decal) grows/shrinks on screen as you zoom, but a
                                    // plain DOM box has no concept of camera FOV, so it stayed a fixed
                                    // pixel size — drifting out of sync with the real decal the moment
                                    // you zoomed away from wherever the factor happened to be tuned
                                    // for. Same baseHfov/currentHfov formula already used for the
                                    // selected cover-up's own edit box (coverupPopupScreen below).
                                    const zoomScale = isFloor
                                        ? (activeScene.initial_hfov ?? DEFAULT_HFOV) / (pinPos.hfov || activeScene.initial_hfov || DEFAULT_HFOV)
                                        : 1
                                    const boxSize = isFloor ? size * 0.25 * FLOOR_SIZE_MULTIPLIER * zoomScale : size
                                    // Gizmo ring geometry, hoisted up here (not just computed inside
                                    // the gizmo's own render below) because the drag/reposition hit
                                    // target right below needs to know gizmoFlat too — it has to stay
                                    // SMALLER than where the X/Y ellipses' own hit-strokes start, or
                                    // it swallows most of the ellipse for anything but the smallest
                                    // boxSize (pulse ring's default size (90px) is bigger than a
                                    // flattened ellipse's own short axis, so a naive "reposition hit
                                    // target = the whole box" would cover nearly the entire X/Y ring,
                                    // leaving only Z clickable — exactly the "red/green don't
                                    // respond, only blue does" bug this fixes).
                                    const gizmoR    = Math.max(55, boxSize / 2 + 20)
                                    const gizmoFlat = gizmoR * 0.42
                                    const gizmoHit  = 14
                                    // The real landmark marker is anchored 'bottom center' — its
                                    // dot sits exactly on pinPos, with the line+label rising above.
                                    // The box below is centered on pinPos for every other type
                                    // (translate(-50%,-50%)); for landmark it's bottom-anchored
                                    // instead (translate(-50%,-100%)) so this preview's dot lands
                                    // on the real point too, not size/2 px below it.
                                    return (
                                        <div ref={pinBoxRef} className="absolute z-30" style={{ left: pinPos.x, top: pinPos.y, transform: isLandmark ? 'translate(-50%,-100%)' : 'translate(-50%,-50%)' }}>
                                            <div style={{ width: boxSize, height: boxSize, position: 'relative', transform: boxTransform, transformOrigin: 'center center' }}>
                                                {isLandmark ? (
                                                    <div
                                                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); pinGestureRef.current = null; setIsDraggingPin(true) }}
                                                        className={`w-full h-full flex items-end justify-center select-none ${isDraggingPin ? 'cursor-grabbing' : 'cursor-grab'}`}
                                                        // height/color/label-color are baked into the
                                                        // returned markup's own inline style attribute by
                                                        // landmarkMarkerHtml itself — a style prop set HERE
                                                        // (on this wrapper) would be shadowed by that, since
                                                        // .lm's own attribute wins over an ancestor's value
                                                        // for the same custom property. This is exactly the
                                                        // bug that made editing always show default size/
                                                        // color while the bounding box alone resized.
                                                        dangerouslySetInnerHTML={{ __html: landmarkMarkerHtml(popupState.label, size, popupState.color, popupState.label_color) }}
                                                    />
                                                ) : (
                                                    <img
                                                        src={popupState.custom_icon_url || (ARROWS.find(a => a.type === popupState.arrow_type) || ARROWS[0]).gif}
                                                        alt=""
                                                        draggable={false}
                                                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); pinGestureRef.current = null; setIsDraggingPin(true) }}
                                                        style={{
                                                            width: '100%', height: '100%', display: 'block',
                                                            // Needed for zIndex (below) to have any effect at
                                                            // all — a statically-positioned element ignores
                                                            // z-index entirely.
                                                            position: 'relative',
                                                            // Invisible for floor — the real, live-updating
                                                            // imageLayer marker (mainLoop's
                                                            // 'hs_floor_preview') shows the actual look;
                                                            // this stays purely as the drag/resize hit target,
                                                            // so an outlined flat sticker doesn't float on
                                                            // top of the true 3D-tilted decal underneath it.
                                                            opacity: isFloor ? 0 : 1,
                                                            // No outline wherever the gizmo shows (floor or
                                                            // pulse) — a solid square border sitting right
                                                            // where the rings pass near the corners competed
                                                            // with them visually and made it easy to miss a
                                                            // ring and land on a resize handle instead. The
                                                            // gizmo itself is enough of a "this is being
                                                            // edited" indicator, same as floor already relies
                                                            // on with no outline at all.
                                                            outline: showGizmo ? 'none' : '2px solid var(--editor-indigo-700)',
                                                            outlineOffset: '2px',
                                                            // NOT elevated above the gizmo (that was tried and
                                                            // reverted — see the dedicated drag-dot below):
                                                            // raising the whole image's z-index worked for
                                                            // floor's small box, but pulse's default box is
                                                            // BIGGER than the X/Y ellipses' own short axis, so
                                                            // it ended up covering nearly the entire red/green
                                                            // ring, leaving only blue (a true circle, always
                                                            // safely outside the image's square) clickable.
                                                        }}
                                                        className={`object-contain select-none ${showGizmo ? '' : 'drop-shadow-[0_3px_12px_rgba(0,0,0,0.85)]'} ${isDraggingPin ? 'cursor-grabbing' : 'cursor-grab'}`}
                                                    />
                                                )}
                                            </div>
                                            {/* Interactive controls — corner handles, drag-dot, and
                                                (for floor/pulse) the 3-ring gizmo — live in their own,
                                                UNtransformed layer, separate from the div above that
                                                carries boxTransform. For pulse specifically, boxTransform
                                                includes a real perspective/rotateX/rotateY 3D tilt (the
                                                whole point of that CSS transform is to make the glyph
                                                itself visibly tilt) — nesting the gizmo inside that same
                                                transform made the red/green/blue reference rings tilt
                                                right along with the object, so at any real rotation they
                                                visually collapsed into/behind the glyph instead of staying
                                                a fixed frame you rotate the object relative to (the actual
                                                Unreal/Blender convention this gizmo is modeled on: the
                                                rings stay put, only the object spins). For every other
                                                type this div still gets boxTransform applied directly
                                                below, so the corner handles / single Z dot+line keep
                                                rotating with the box exactly as before — only floor/pulse
                                                (where boxTransform is either 'none' already, or a real 3D
                                                tilt that must NOT leak into the gizmo) skip it. */}
                                            <div className="absolute" style={{ left: 0, top: 0, width: boxSize, height: boxSize, transform: showGizmo ? 'none' : boxTransform, transformOrigin: 'center center' }}>
                                                {/* This whole div sits ON TOP of the image above (any
                                                    absolutely-positioned box paints after in-flow content
                                                    regardless of DOM order) — for floor/pulse that's fine,
                                                    they drag via the dedicated gizmo center-dot below. Every
                                                    OTHER type (forward/left/up-left/up-right/circle/custom)
                                                    has no gizmo and therefore no dot, so without this their
                                                    own mousedown handler on the <img> underneath was
                                                    unreachable — a click anywhere except the 4 tiny corner
                                                    handles hit this empty div and did nothing. This is that
                                                    bug's actual fix: a full-box reposition target, sat BELOW
                                                    the corner handles (z-index 1 vs their 2) so resize still
                                                    wins exactly at the corners. */}
                                                {!showGizmo && (
                                                    <div
                                                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); pinGestureRef.current = null; setIsDraggingPin(true) }}
                                                        className={isDraggingPin ? 'cursor-grabbing' : 'cursor-grab'}
                                                        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
                                                    />
                                                )}
                                                {showGizmo && (() => {
                                                    // Dedicated small reposition-drag target, centered —
                                                    // sized to stay safely INSIDE where the X/Y ellipses'
                                                    // own hit-stroke starts (gizmoFlat), so it can sit
                                                    // above the gizmo's hit-paths (guaranteeing a center
                                                    // click always repositions) without swallowing the
                                                    // ring itself the way giving the whole image that same
                                                    // priority did.
                                                    const dotR = Math.max(10, gizmoFlat - gizmoHit / 2 - 4)
                                                    return (
                                                        <div
                                                            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); pinGestureRef.current = null; setIsDraggingPin(true) }}
                                                            className={isDraggingPin ? 'cursor-grabbing' : 'cursor-grab'}
                                                            style={{
                                                                position: 'absolute', left: '50%', top: '50%',
                                                                width: dotR * 2, height: dotR * 2, borderRadius: '50%',
                                                                transform: 'translate(-50%,-50%)', zIndex: 1,
                                                            }}
                                                        />
                                                    )
                                                })()}
                                                <div onMouseDown={startPinResize}
                                                     className="absolute w-2.5 h-2.5 bg-white border-2 border-editor-primary rounded-sm cursor-nwse-resize"
                                                     style={{ left: 0, top: 0, transform: 'translate(-50%,-50%)', zIndex: 2 }}/>
                                                <div onMouseDown={startPinResize}
                                                     className="absolute w-2.5 h-2.5 bg-white border-2 border-editor-primary rounded-sm cursor-nesw-resize"
                                                     style={{ left: '100%', top: 0, transform: 'translate(-50%,-50%)', zIndex: 2 }}/>
                                                <div onMouseDown={startPinResize}
                                                     className="absolute w-2.5 h-2.5 bg-white border-2 border-editor-primary rounded-sm cursor-nesw-resize"
                                                     style={{ left: 0, top: '100%', transform: 'translate(-50%,-50%)', zIndex: 2 }}/>
                                                <div onMouseDown={startPinResize}
                                                     className="absolute w-2.5 h-2.5 bg-white border-2 border-editor-primary rounded-sm cursor-nwse-resize"
                                                     style={{ left: '100%', top: '100%', transform: 'translate(-50%,-50%)', zIndex: 2 }}/>
                                                {showGizmo ? (() => {
                                                    // Unreal/Blender-style 3-ring gizmo — the on-canvas
                                                    // drag counterpart to the Rotate X/Y/Z sliders (see
                                                    // startAxisRotate). Purely a 2D DOM/SVG overlay like
                                                    // every other edit-time control here (PSV markers can't
                                                    // be dragged natively), so it can't be dynamically
                                                    // perspective-correct — instead it uses the same static
                                                    // convention every 3D tool's gizmo relies on for
                                                    // legibility: a plain circle for the ring facing the
                                                    // screen (Z), fixed-aspect ellipses for the other two
                                                    // (X/Y), red/green/blue (the universal X/Y/Z color
                                                    // convention — a deliberate one-off departure from this
                                                    // app's indigo theme, since that convention is the
                                                    // whole point of "gizmo style like Unreal"). Each ring
                                                    // is drawn twice: a wide invisible stroke for a
                                                    // comfortable grab target, then the thin visible one on
                                                    // top (pointer-events:none, so it doesn't shrink the
                                                    // hit area to the visible line's own width).
                                                    // Floored at 55px radius — a tiny/zoomed-out decal was
                                                    // shrinking the rings right along with the box down to
                                                    // a few px, at which point a thin colored line is
                                                    // basically imperceptible. The rings are a control, not
                                                    // a size indicator (that's the box itself), so they stay
                                                    // comfortably grabbable regardless of how small the
                                                    // decal currently looks.
                                                    // r/flat/HIT are the hoisted gizmoR/gizmoFlat/gizmoHit
                                                    // above — shared with the dedicated drag-dot, which
                                                    // needs the exact same geometry to stay safely clear
                                                    // of these rings.
                                                    const r    = gizmoR
                                                    const flat = gizmoFlat
                                                    const HIT  = gizmoHit
                                                    // A real width/height + viewBox, not the "0×0 element
                                                    // with overflow:visible" trick used elsewhere in this
                                                    // file (e.g. the dashed connector lines) — that trick
                                                    // works fine for plain strokes, but a CSS filter (the
                                                    // drop-shadow below, for contrast against bright floors)
                                                    // computes its effect region from the element's OWN box,
                                                    // not from overflow: on a genuinely 0×0 SVG, browsers
                                                    // clip the filtered output to nothing — the invisible
                                                    // hit-target strokes still registered clicks (SVG
                                                    // geometry, unaffected by the filter), which is exactly
                                                    // why dragging worked while nothing was ever visible.
                                                    const box = r * 2 + HIT
                                                    const cx = box / 2, cy = box / 2
                                                    // Each ring is drawn as two half-arcs rather than one
                                                    // closed ellipse — solid on one side, faint + dashed on
                                                    // the other. Purely a legibility trick (this is a flat
                                                    // 2D overlay, not a genuinely perspective-correct 3D gizmo, same
                                                    // as everywhere else in this preview), but it's the same
                                                    // "near/far half" convention real 3D gizmos use, and it
                                                    // reads as a ring wrapping around the object instead of
                                                    // a flat circle sitting on top of it — thinner and less
                                                    // visually loud than solid rings, which is what made the
                                                    // full-strength version feel heavy.
                                                    const solid = { strokeWidth: 1.75, pointerEvents: 'none' }
                                                    const faint = { strokeWidth: 1.25, strokeOpacity: 0.4, strokeDasharray: '2.5,3', pointerEvents: 'none' }
                                                    const hit   = axis => ({
                                                        onMouseDown: e => startAxisRotate(e, axis),
                                                        style: { cursor: ROTATE_CURSOR, pointerEvents: 'stroke' },
                                                    })
                                                    const svgPos = { left: `calc(50% - ${cx}px)`, top: `calc(50% - ${cy}px)` }
                                                    // Split across TWO svg elements, sandwiching the
                                                    // drag/resize image (zIndex 1) between them, rather than
                                                    // one svg at a single z-index — floor's image is
                                                    // invisible so this wouldn't have mattered there, but
                                                    // pulse's is a real visible billboard, often bigger than
                                                    // the gizmo's flattened X/Y ellipses at default size, so
                                                    // the two need to interleave correctly:
                                                    //  - hit-paths BELOW the image (zIndex 0): wherever the
                                                    //    image covers them, the image — being on top — wins
                                                    //    hit-testing, so a drag click there repositions the
                                                    //    hotspot instead of grabbing a ring. Outside the
                                                    //    image's footprint they're uncovered and still work
                                                    //    normally.
                                                    //  - visible strokes ABOVE the image (zIndex 2), with
                                                    //    pointer-events:none — they paint on top so the rings
                                                    //    stay fully visible even where they cross the image,
                                                    //    but being non-interactive there, clicks fall through
                                                    //    to whatever's underneath instead of being swallowed.
                                                    return (
                                                        <>
                                                            <svg className="absolute" width={box} height={box} viewBox={`0 0 ${box} ${box}`} style={{ ...svgPos, zIndex: 0 }}>
                                                                <ellipse cx={cx} cy={cy} rx={r} ry={flat} fill="none" stroke="transparent" strokeWidth={HIT} {...hit('x')}/>
                                                                <ellipse cx={cx} cy={cy} rx={flat} ry={r} fill="none" stroke="transparent" strokeWidth={HIT} {...hit('y')}/>
                                                                <circle cx={cx} cy={cy} r={r} fill="none" stroke="transparent" strokeWidth={HIT} {...hit('z')}/>
                                                            </svg>
                                                            <svg className="absolute" width={box} height={box} viewBox={`0 0 ${box} ${box}`}
                                                                 style={{ ...svgPos, zIndex: 2, pointerEvents: 'none', filter: 'drop-shadow(0 0 2.5px rgba(0,0,0,.85))' }}>
                                                                {/* X — red, wide/short ellipse (tilt around the horizontal axis) */}
                                                                <path d={`M ${cx - r} ${cy} A ${r} ${flat} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#ef4444" style={solid}/>
                                                                <path d={`M ${cx + r} ${cy} A ${r} ${flat} 0 0 1 ${cx - r} ${cy}`} fill="none" stroke="#ef4444" style={faint}/>
                                                                {/* Y — green, narrow/tall ellipse (turn around the vertical axis) */}
                                                                <path d={`M ${cx} ${cy - r} A ${flat} ${r} 0 0 1 ${cx} ${cy + r}`} fill="none" stroke="#22c55e" style={solid}/>
                                                                <path d={`M ${cx} ${cy + r} A ${flat} ${r} 0 0 1 ${cx} ${cy - r}`} fill="none" stroke="#22c55e" style={faint}/>
                                                                {/* Z — blue, full circle (spin in the screen plane) */}
                                                                <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#3b82f6" style={solid}/>
                                                                <path d={`M ${cx + r} ${cy} A ${r} ${r} 0 0 1 ${cx - r} ${cy}`} fill="none" stroke="#3b82f6" style={faint}/>
                                                            </svg>
                                                        </>
                                                    )
                                                })() : (
                                                    <>
                                                        <div className="absolute pointer-events-none"
                                                             style={{ left: '50%', top: -28, width: 1, height: 28, borderLeft: '1px solid var(--editor-indigo-700)' }}/>
                                                        <div onMouseDown={startPinRotate}
                                                             className="absolute w-3 h-3 bg-white border-2 border-editor-primary rounded-full"
                                                             style={{ left: '50%', top: -28, transform: 'translate(-50%,-50%)', zIndex: 2, cursor: ROTATE_CURSOR }}/>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })()}

                                {/* Editing a zone's shape: a full-screen capture surface feeds
                                    drag moves to whichever corner grabbed it, an SVG outline
                                    traces the live (possibly mid-drag) points so the shape
                                    itself visibly updates, and a small handle sits on every
                                    corner — same "PSV markers can't be dragged, so do it in
                                    plain DOM" pattern as the hotspot pin's own corner handles. */}
                                {isDraggingVertex && (
                                    <div className="absolute inset-0 z-40 cursor-grabbing"
                                         onMouseMove={onVertexDragMove}
                                         onMouseUp={endVertexDrag}
                                         onMouseLeave={endVertexDrag}/>
                                )}

                                {polygonPopup?.mode === 'edit' && polygonVertexScreens.length === polygonPopup.points.length && (
                                    <>
                                        <svg className="absolute inset-0 z-30 pointer-events-none overflow-visible" width="100%" height="100%">
                                            <polygon
                                                points={polygonVertexScreens.map(p => `${p.x},${p.y}`).join(' ')}
                                                fill="var(--editor-indigo-700)" fillOpacity="0.15"
                                                stroke="var(--editor-indigo-700)" strokeWidth="2" strokeDasharray="6,3"
                                            />
                                        </svg>
                                        {polygonVertexScreens.map((p, i) => (
                                            <div key={i}
                                                 onMouseDown={e => startVertexDrag(e, i)}
                                                 className="absolute z-30 w-3.5 h-3.5 bg-white border-2 border-editor-primary rounded-full cursor-grab active:cursor-grabbing"
                                                 style={{ left: p.x, top: p.y, transform: 'translate(-50%,-50%)' }}/>
                                        ))}
                                        {/* Plot-dimension labels — one per edge, at its screen
                                            midpoint, only where a length was actually typed in
                                            (the panel's "Plot dimensions" section). Read-only here;
                                            editing happens in the panel, not on the canvas. */}
                                        {polygonVertexScreens.map((p, i) => {
                                            const q = polygonVertexScreens[(i + 1) % polygonVertexScreens.length]
                                            const label = polygonPopup.edge_lengths?.[i]
                                            if (!p || !q || !label) return null
                                            return (
                                                <div key={`el-${i}`}
                                                     className="absolute z-30 pointer-events-none bg-black/70 backdrop-blur text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
                                                     style={{ left: (p.x + q.x) / 2, top: (p.y + q.y) / 2, transform: 'translate(-50%,-50%)' }}>
                                                    {label}
                                                </div>
                                            )
                                        })}
                                    </>
                                )}

                                {isEditing && !isDraggingPin && (
                                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-black/65 backdrop-blur text-white text-[11px] font-medium px-3 py-1.5 rounded-full">
                                        Drag the arrow to adjust · fill form in the panel
                                    </div>
                                )}
                                {isDraggingPin && (
                                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-black/65 backdrop-blur text-white text-[11px] font-medium px-3 py-1.5 rounded-full">
                                        {pinGestureRef.current?.mode === 'resize' ? 'Resizing the arrow'
                                            : pinGestureRef.current?.mode === 'rotate' ? 'Rotating the arrow'
                                            : 'Release to place'}
                                    </div>
                                )}
                                {draggingOverlay && (
                                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-black/65 backdrop-blur text-white text-[11px] font-medium px-3 py-1.5 rounded-full">
                                        {logos.some(l => l.id === draggingOverlay)
                                            ? 'Drag the logo · it stays put on screen'
                                            : overlayGestureRef.current?.mode === 'resize' ? 'Resizing the cover-up'
                                            : overlayGestureRef.current?.mode === 'rotate' ? 'Rotating the cover-up'
                                            : 'Drag the cover-up · it moves in every scene at once'}
                                    </div>
                                )}
                                {drawingPolygon && (
                                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-black/70 backdrop-blur text-white text-[11px] font-medium px-3 py-1.5 rounded-full">
                                        <span>
                                            {drawingPolygon.points.length} point{drawingPolygon.points.length === 1 ? '' : 's'}
                                            {' · '}{drawingPolygon.points.length < 3 ? 'need 3+ to finish' : 'Finish when done · Ctrl+Z to undo a point'}
                                        </span>
                                        <button onClick={finishDrawingPolygon} disabled={drawingPolygon.points.length < 3}
                                                className="h-6 px-2.5 rounded-full bg-editor-primary text-white font-semibold disabled:opacity-40 transition-colors">
                                            Finish
                                        </button>
                                        <button onClick={cancelDrawingPolygon}
                                                className="h-6 px-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white font-semibold transition-colors">
                                            Cancel
                                        </button>
                                    </div>
                                )}

                                <CameraControls psvRef={psvRef}
                                                 onSaveView={saveCurrentViewAsOpening}
                                                 savingView={savingView}
                                                 savedView={savedViewTick}/>
                            </>
                        )}
                    </div>

                    {/* Hide/show toggle — collapses the Directions/Overlays/
                        Zones column entirely rather than letting it be
                        dragged narrower/wider. Same small floating pill as
                        the left panel's own toggle. */}
                    <div className="relative w-0 shrink-0 z-20">
                        <button onClick={() => setRightPanelOpen(o => !o)}
                                title={rightPanelOpen ? 'Hide panel' : 'Show panel'}
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-11 rounded-full
                                           border border-editor-border bg-white shadow-[0_1px_4px_rgba(0,0,0,0.1)]
                                           text-editor-icon-idle hover:border-editor-primary hover:bg-editor-primary
                                           hover:text-white transition-colors flex items-center justify-center">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                                {rightPanelOpen ? <path d="M9 18l6-6-6-6"/> : <path d="M15 18l-6-6 6-6"/>}
                            </svg>
                        </button>
                    </div>

                    {/* Right — Directions / Overlays / Zones share one column now,
                        switched via tabs, instead of three sections hard-stacked in
                        fixed-height blocks (that stacking is what silently clipped
                        the arrow palette on shorter viewports). */}
                    {rightPanelOpen && (
                    <div className="w-[240px] shrink-0 relative overflow-hidden flex flex-col">
                        <PanelTabs
                            active={activeRightTab}
                            // A zone's form now lives in this same column
                            // (see PolygonPanel below) instead of floating
                            // over the canvas independent of whatever tab
                            // was active. It auto-saves (see
                            // closePolygonPopup/the debounce effect), so a
                            // tab click just flushes whatever's pending and
                            // moves on, rather than needing to block the
                            // switch outright the way an unsaved form would.
                            onChange={tab => { closePolygonPopup(); setActiveRightTab(tab) }}
                            tabs={[
                                { key: 'directions', label: 'Directions', count: hotspots.filter(h => h.scene_id === activeScene?.id).length },
                                { key: 'overlays',   label: 'Overlays',   count: logos.length + coverups.length, dot: dirtyLogos || dirtyCoverups },
                                { key: 'zones',      label: 'Zones',      count: visiblePolygons.length },
                            ]}/>
                        <div className="flex-1 min-h-0 relative overflow-hidden">
                            {activeRightTab === 'directions' && !polygonPopup && (
                                <HotspotPanel scenes={scenes} activeSceneId={activeScene?.id}
                                              hotspots={hotspots} onDeleteHotspot={requestDeleteHotspot}
                                              popupState={popupState} onUpdatePopup={setPopupState}
                                              onSavePopup={handleSave} onCancelPopup={() => setPopupState(null)}
                                              onSelectHotspot={id => onHotspotClickRef.current?.(id)}
                                              onUploadImage={uploadOverlayImage} savingHotspot={flags.savingHotspot}
                                              deletingHotspot={deletingHotspot}
                                              formRef={hotspotFormRef}/>
                            )}
                            {activeRightTab === 'overlays' && !polygonPopup && (
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
                            )}
                            {(activeRightTab === 'zones' || polygonPopup) && (
                                <PolygonPanel
                                    polygons={visiblePolygons}
                                    selectedId={polygonPopup?.polygon?.id ?? null}
                                    activeSceneId={activeScene?.id}
                                    scenes={scenes}
                                    hotspots={hotspots}
                                    drawing={!!drawingPolygon}
                                    onStartDraw={startDrawingPolygon}
                                    onSelect={selectPolygon}
                                    onDelete={requestDeletePolygon}
                                    polygonPopup={polygonPopup}
                                    onUpdatePopup={next => { setJustSavedPolygon(false); setPolygonPopup({ ...next, _dirty: true }) }}
                                    onDeletePopup={() => requestDeletePolygon(polygonPopup.polygon.id)}
                                    onCancelPopup={() => closePolygonPopup()}
                                    onSaveNowPopup={saveZoneNow}
                                    onUploadImage={uploadOverlayImage}
                                    savingPolygon={savingPolygon}
                                    justSavedPolygon={justSavedPolygon}
                                    deletingPolygon={deletingPolygon}/>
                            )}
                        </div>
                    </div>
                    )}
                </div>
            </div>

            {showSettings && settingsDraft && (
                <SettingsModal draft={settingsDraft} onChange={setSettingsDraft}
                               onSave={saveSettings} onClose={() => setShowSettings(false)}
                               saving={flags.savingSettings}/>
            )}
            {showEmbedModal && publicUrl && (
                <EmbedModal url={publicUrl} onClose={() => setShowEmbedModal(false)}/>
            )}
            {confirmDelete && (
                <ConfirmDeleteModal
                    title="Delete project?"
                    description={`This will permanently delete "${project?.name}" and all its scenes and hotspots.`}
                    confirmLabel="Delete project"
                    onConfirm={deleteProject}
                    onClose={() => setConfirmDelete(false)}
                    deleting={flags.deleting}/>
            )}
            {hotspotToDelete && (() => {
                const targetName = scenes.find(s => s.id === hotspotToDelete.target_scene_id)?.name
                return (
                    <ConfirmDeleteModal
                        title="Delete this hotspot?"
                        description={`${hotspotToDelete.label ? `"${hotspotToDelete.label}"` : 'This arrow'}${targetName ? ` (goes to ${targetName})` : ''} will be removed from this scene.`}
                        confirmLabel="Delete"
                        onConfirm={confirmDeleteHotspot}
                        onClose={() => setHotspotToDelete(null)}
                        deleting={deletingHotspot}/>
                )
            })()}
            {polygonToDelete && (
                <ConfirmDeleteModal
                    title="Delete this zone?"
                    description={`${polygonToDelete.label ? `"${polygonToDelete.label}"` : 'This zone'} will be removed from this scene.`}
                    confirmLabel="Delete"
                    onConfirm={confirmDeletePolygon}
                    onClose={() => setPolygonToDelete(null)}
                    deleting={deletingPolygon}/>
            )}
            {previewHtml && (
                <TourPreviewModal html={previewHtml} projectName={project?.name}
                                  onClose={() => { previewOpenRef.current = false; setPreviewHtml(null) }}/>
            )}
        </>
    )
}
