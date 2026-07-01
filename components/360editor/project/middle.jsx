'use client'
import React, { useEffect, useRef, useState, useCallback, useReducer } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ScenePanel       from '@/components/360editor/project/scene_panel'
import HotspotPanel, { ARROWS } from '@/components/360editor/project/hotspot_panel'
import TourPreviewModal from '@/components/360editor/project/preview'
import { buildTourHtml } from '@/components/360editor/project/export'
import { HotspotPopup } from '@/components/360editor/project/hotspot_overlay'

// ─── Pannellum projection math ────────────────────────────────────────────────

const DEG = Math.PI / 180

function screenToPitchYaw(sx, sy, viewPitch, viewYaw, hfov, W, H) {
    const vp    = -viewPitch * DEG
    const f     = (W / 2) / Math.tan(hfov * DEG / 2)
    const u     = (sx - W / 2) / f
    const v     = (H / 2 - sy) / f
    const cosVP = Math.cos(vp), sinVP = Math.sin(vp)
    const y0    = -cosVP - v * sinVP
    const z0    = -sinVP + v * cosVP
    const pitch = Math.atan2(z0, Math.sqrt(u * u + y0 * y0)) / DEG
    let   yaw   = Math.atan2(u, -y0) / DEG + viewYaw
    yaw = ((yaw + 180) % 360 + 360) % 360 - 180
    return { pitch, yaw }
}

function pitchYawToScreen(pitch, yaw, viewPitch, viewYaw, hfov, W, H) {
    const p     = pitch * DEG
    const dy    = (yaw - viewYaw) * DEG
    const vp    = -viewPitch * DEG
    const cosP  = Math.cos(p)
    const cosVP = Math.cos(vp), sinVP = Math.sin(vp)
    const x0    = cosP * Math.sin(dy)
    const y0    = -cosP * Math.cos(dy)
    const z0    = Math.sin(p)
    const y1    = y0 * cosVP + z0 * sinVP
    const z1    = -y0 * sinVP + z0 * cosVP
    if (y1 >= 0) return null
    const f  = (W / 2) / Math.tan(hfov * DEG / 2)
    const sx = W / 2 + f * (x0 / (-y1))
    const sy = H / 2 - f * (z1 / (-y1))
    if (sx < -W || sx > 2 * W || sy < -H || sy > 2 * H) return null
    return { x: sx, y: sy }
}

function roundTo2(n) { return parseFloat(n.toFixed(2)) }
function clampPct(n) { return Math.min(100, Math.max(0, n)) }

// ─── Small shared UI ──────────────────────────────────────────────────────────

function Spinner({ size = 12 }) {
    return (
        <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24"
             fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
    )
}

function CameraControls({ pannellumRef }) {
    const controls = [
        { label: '▲', fn: v => v.setPitch(v.getPitch() + 10) },
        { label: '▼', fn: v => v.setPitch(v.getPitch() - 10) },
        { label: '◀', fn: v => v.setYaw(v.getYaw() - 10)    },
        { label: '▶', fn: v => v.setYaw(v.getYaw() + 10)    },
        { label: '+', fn: v => v.setHfov(v.getHfov() - 10)  },
        { label: '−', fn: v => v.setHfov(v.getHfov() + 10)  },
    ]
    return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {controls.map((c, i) => (
                <button key={i} onClick={() => pannellumRef.current && c.fn(pannellumRef.current)}
                        className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur text-[#1a1a18] text-[13px] font-bold hover:bg-white shadow-sm border border-[#E2E2DA] transition-colors">
                    {c.label}
                </button>
            ))}
        </div>
    )
}

function SettingsModal({ draft, onChange, onSave, onClose, saving, projectId, onProjectChange }) {
    const [uploading, setUploading] = useState(false)
    const [uploadErr, setUploadErr] = useState('')
    const fileRef = useRef(null)

    // Upload goes through the server route — the client never touches storage.
    async function handleFile(e) {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadErr(''); setUploading(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            if (draft.logo_url) fd.append('old_url', draft.logo_url)   // replace = delete old + add new
            const res  = await fetch(`/api/projects/${projectId}/logo`, { method: 'POST', body: fd })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.error || 'Upload failed')
            onChange({ ...draft, logo_url: data.url })
        } catch (err) {
            setUploadErr(err?.message || 'Upload failed')
        } finally {
            setUploading(false)
            if (fileRef.current) fileRef.current.value = ''
        }
    }

    // Remove from storage AND from the table (immediately, not on Save).
    async function handleRemove() {
        if (!draft.logo_url) return
        setUploading(true)
        try {
            const res  = await fetch(`/api/projects/${projectId}/logo`, {
                method: 'DELETE', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ url: draft.logo_url }),
            })
            const data = await res.json().catch(() => ({}))
            if (res.ok && data?.project) onProjectChange?.(data.project)   // clears the logo from the live viewer
            onChange({ ...draft, logo_url: '' })
        } finally { setUploading(false) }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl border border-[#E2E2DA] shadow-2xl p-6 w-[360px] space-y-4">
                <p className="text-[14px] font-semibold text-[#1a1a18]">Project settings</p>

                {/* ── Logo upload ── */}
                <div className="space-y-1.5">
                    <label className="text-[11px] text-[#6b6b60] uppercase tracking-wider">
                        Logo <span className="normal-case opacity-60">(optional watermark)</span>
                    </label>

                    {draft.logo_url ? (
                        <div className="flex items-center gap-2.5 p-2 border border-[#E2E2DA] rounded-lg">
                            <div className="w-12 h-12 rounded-md bg-[#F4F4EF] border border-[#E2E2DA] flex items-center justify-center shrink-0 overflow-hidden">
                                <img src={draft.logo_url} alt="logo" className="w-full h-full object-contain p-1"/>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-medium text-[#1a1a18] truncate">Logo uploaded</p>
                                <p className="text-[10px] text-[#6b6b60]">Drag it on the viewer to position it.</p>
                            </div>
                            <div className="flex flex-col gap-1 shrink-0">
                                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                                        className="text-[10px] px-2 py-1 rounded-md border border-[#E2E2DA] text-[#6b6b60] hover:bg-[#F4F4EF] disabled:opacity-40 transition-colors">
                                    Replace
                                </button>
                                <button onClick={handleRemove} disabled={uploading}
                                        className="text-[10px] px-2 py-1 rounded-md border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors">
                                    Remove
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => fileRef.current?.click()} disabled={uploading}
                                className="w-full h-20 border-2 border-dashed border-[#E2E2DA] rounded-lg flex flex-col items-center justify-center gap-1 text-[#6b6b60] hover:border-[#3730a3]/40 hover:bg-[#3730a3]/5 disabled:opacity-50 transition-colors">
                            {uploading
                                ? <><Spinner/><span className="text-[11px]">Uploading…</span></>
                                : <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="17 8 12 3 7 8"/>
                                        <line x1="12" y1="3" x2="12" y2="15"/>
                                    </svg>
                                    <span className="text-[11px] font-medium">Upload a logo image</span>
                                    <span className="text-[10px] opacity-70">PNG with transparency works best</span>
                                </>}
                        </button>
                    )}

                    <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden"/>
                    {uploadErr && <p className="text-[10px] text-red-500">{uploadErr}</p>}
                    <p className="text-[10px] text-[#6b6b60]">Stays fixed on screen while the panorama rotates. Drag it on the viewer to place it.</p>
                </div>

                <div className="space-y-1">
                    <label className="text-[11px] text-[#6b6b60] uppercase tracking-wider">Auto-rotate speed</label>
                    <input type="number" step="0.5" value={draft.auto_rotate}
                           onChange={e => onChange({ ...draft, auto_rotate: parseFloat(e.target.value) || 0 })}
                           className="w-full h-8 border border-[#E2E2DA] rounded-lg px-2.5 text-[12px] focus:outline-none focus:border-[#3730a3]"/>
                    <p className="text-[10px] text-[#6b6b60]">Degrees/sec. Negative = clockwise. 0 = off.</p>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={draft.show_intro}
                           onChange={e => onChange({ ...draft, show_intro: e.target.checked })}
                           className="w-4 h-4 accent-[#3730a3]"/>
                    <span className="text-[12px] text-[#1a1a18]">Show "tap to move" intro tip on first load</span>
                </label>
                <div className="flex gap-2 pt-1">
                    <button onClick={onClose} disabled={saving}
                            className="flex-1 h-9 text-[12px] rounded-xl border border-[#E2E2DA] text-[#6b6b60] hover:bg-[#F4F4EF] transition-colors disabled:opacity-40">
                        Cancel
                    </button>
                    <button onClick={onSave} disabled={saving || uploading}
                            className="flex-1 h-9 text-[12px] rounded-xl bg-[#3730a3] text-white font-semibold hover:bg-[#312e81] disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
                        {saving ? <><Spinner/>Saving…</> : 'Save settings'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function DeleteModal({ projectName, onConfirm, onClose, deleting }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl border border-[#E2E2DA] shadow-2xl p-6 w-[320px]">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                    </div>
                    <div>
                        <p className="text-[14px] font-semibold text-[#1a1a18]">Delete project?</p>
                        <p className="text-[11px] text-[#6b6b60] mt-0.5">
                            This will permanently delete "{projectName}" and all its scenes and hotspots.
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 mt-4">
                    <button onClick={onClose} disabled={deleting}
                            className="flex-1 h-9 text-[12px] rounded-xl border border-[#E2E2DA] text-[#6b6b60] hover:bg-[#F4F4EF] transition-colors disabled:opacity-40">
                        Cancel
                    </button>
                    <button onClick={onConfirm} disabled={deleting}
                            className="flex-1 h-9 text-[12px] rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                        {deleting ? <><Spinner/>Deleting…</> : 'Delete project'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Flags reducer ────────────────────────────────────────────────────────────
const flagsInit = { exporting: false, savingSettings: false, deleting: false, savingHotspot: false }
function flagsReducer(state, action) { return { ...state, [action]: !state[action] } }

// ─── Main editor component ────────────────────────────────────────────────────

export default function ProjectClient({ projectId }) {
    const router           = useRouter()
    const viewerRef        = useRef(null)
    const pannellumRef     = useRef(null)
    const viewerSceneIdRef = useRef(null)
    const rafRef           = useRef(null)
    const scenesRef        = useRef([])
    const popupRef         = useRef(null)
    const onHotspotClickRef = useRef(null)
    const logoDragRef       = useRef(null)   // { offX, offY } in px while dragging the logo
    const logoImgRef        = useRef(null)   // measures the rendered logo so it never leaves the frame
    const previewOpenRef    = useRef(false)  // pause the rAF loop while the preview modal is open

    const [project, setProject]                 = useState(null)
    const [scenes, setScenes]                   = useState([])
    const [hotspots, setHotspots]               = useState([])
    const [activeScene, setActiveScene]         = useState(null)
    const [loading, setLoading]                 = useState(true)
    const [isDragOver, setIsDragOver]           = useState(false)
    const [pannellumLoaded, setPannellumLoaded] = useState(false)
    const [isDraggingPin, setIsDraggingPin]     = useState(false)
    const [showSettings, setShowSettings]       = useState(false)
    const [settingsDraft, setSettingsDraft]     = useState(null)
    const [confirmDelete, setConfirmDelete]     = useState(false)
    const [pinPos, setPinPos]                   = useState(null)
    const [viewerSize, setViewerSize]           = useState({ w: 0, h: 0 })
    const [flags, dispatchFlag]                 = useReducer(flagsReducer, flagsInit)
    const [previewHtml, setPreviewHtml]         = useState(null)

    // Logo screen position (percent of viewer) + size (px) + drag state
    const [logoPos, setLogoPos]                 = useState({ x: 50, y: 50 })
    const [logoSize, setLogoSize]               = useState(160)
    const [hotspotSize, setHotspotSize]         = useState(90)
    const [draggingLogo, setDraggingLogo]       = useState(false)

    // popupState modes: 'new' | 'confirm-edit' | 'edit-existing' | 'saved'
    const [popupState, setPopupState] = useState(null)

    scenesRef.current = scenes
    popupRef.current  = popupState

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
                setScenes(data.scenes)
                setHotspots(data.hotspots)
                if (data.scenes.length > 0) setActiveScene(data.scenes[0])
            } catch {
                router.push('/360editor')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [projectId]) // eslint-disable-line

    // ── Sync logo position + size from project ─────────────────────────────
    useEffect(() => {
        if (!project) return
        setLogoPos({ x: project.logo_x ?? 50, y: project.logo_y ?? 50 })
        setLogoSize(project.logo_size ?? 160)
        setHotspotSize(project.hotspot_size ?? 90)
    }, [project?.logo_x, project?.logo_y, project?.logo_size, project?.hotspot_size]) // eslint-disable-line

    // ── Load Pannellum script ──────────────────────────────────────────────
    useEffect(() => {
        if (window.pannellum) { setPannellumLoaded(true); return }
        const link   = Object.assign(document.createElement('link'),   { rel:'stylesheet', href:'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css' })
        const script = Object.assign(document.createElement('script'), { src:'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js', onload:() => setPannellumLoaded(true) })
        document.head.append(link, script)
    }, [])

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

    // ── Hotspot click handler (via stable ref so pannellum closures stay fresh)
    onHotspotClickRef.current = (hotspotId) => {
        const h = hotspots.find(x => x.id === hotspotId)
        if (!h) return
        setPopupState({ mode: 'confirm-edit', hotspot: h })
    }

    // ── makeTooltip — builds each arrow div for pannellum ─────────────────
    const makeTooltip = useCallback((div, args) => {
        const S = args.size || 90
        div.style.cssText = `width:${S}px;height:${S}px;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;`
        const img = Object.assign(document.createElement('img'), { src: args.gif })
        img.style.cssText = `width:${S}px;height:${S}px;object-fit:contain;filter:drop-shadow(0 3px 12px rgba(0,0,0,.85));pointer-events:none;`
        div.appendChild(img)
        const shadow = 'drop-shadow(0 3px 12px rgba(0,0,0,.85))'
        // Hover label — shows the hotspot's description above the arrow.
        let tip = null
        if (args.label) {
            tip = document.createElement('div')
            tip.textContent = args.label
            tip.style.cssText = 'position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:6px;white-space:nowrap;background:rgba(26,26,24,.92);color:#fff;font:600 12px/1.2 Inter,system-ui,sans-serif;padding:5px 9px;border-radius:8px;opacity:0;transition:opacity .15s;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.4);z-index:10;'
            div.appendChild(tip)
        }
        div.addEventListener('mouseenter', () => { img.style.filter = shadow + ' brightness(1.2)'; if (tip) tip.style.opacity = '1' })
        div.addEventListener('mouseleave', () => { img.style.filter = shadow;                     if (tip) tip.style.opacity = '0' })
        div.addEventListener('click',      () => { onHotspotClickRef.current?.(args.hotspotDbId) })
    }, []) // eslint-disable-line

    // ── Viewer init ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!pannellumLoaded || !activeScene || !viewerRef.current) return
        if (viewerSceneIdRef.current === activeScene.id && pannellumRef.current) return

        pannellumRef.current?.destroy?.()
        pannellumRef.current     = null
        viewerSceneIdRef.current = activeScene.id
        setPopupState(null)

        pannellumRef.current = window.pannellum.viewer(viewerRef.current, {
            type: 'equirectangular', panorama: activeScene.url,
            autoLoad: true, showControls: false, autoRotate: 0, mouseZoom: true,
            yaw:   activeScene.initial_yaw   ?? 0,
            pitch: activeScene.initial_pitch ?? -5,
            hfov:  activeScene.initial_hfov  ?? 120,
            hotSpots: [],
        })

        return () => {
            pannellumRef.current?.destroy?.()
            pannellumRef.current     = null
            viewerSceneIdRef.current = null
        }
    }, [pannellumLoaded, activeScene]) // eslint-disable-line

    // ── Hotspot sync — diffs state vs pannellum, handles edits too ─────────
    // While a hotspot is being edited ('edit-existing'), its static arrow is
    // hidden so only the draggable crosshair represents it. It re-appears once
    // we leave edit mode (mode === 'saved' / popup closed).
    useEffect(() => {
        const viewer = pannellumRef.current
        if (!viewer || !activeScene) return

        const renderedMap = new Map()
        try { for (const h of viewer.getConfig()?.hotSpots ?? []) renderedMap.set(h.id, h) } catch {}

        const desired    = hotspots.filter(h => h.scene_id === activeScene.id && h.id !== editingId)
        const desiredIds = new Set(desired.map(h => `hs_${h.id}`))

        for (const id of renderedMap.keys())
            if (!desiredIds.has(id)) { try { viewer.removeHotSpot(id) } catch {} }

        for (const h of desired) {
            const hsId     = `hs_${h.id}`
            const arrow    = ARROWS.find(a => a.type === h.arrow_type)
            const gif      = arrow?.gif || ARROWS[0].gif
            const existing = renderedMap.get(hsId)
            const changed  = existing && (
                existing.pitch !== h.pitch ||
                existing.yaw   !== h.yaw   ||
                existing.createTooltipArgs?.gif  !== gif ||
                existing.createTooltipArgs?.size  !== hotspotSize ||
                existing.createTooltipArgs?.label !== (h.label || '')
            )

            if (changed) { try { viewer.removeHotSpot(hsId) } catch {} }

            if (!existing || changed) {
                try {
                    viewer.addHotSpot({
                        pitch: h.pitch, yaw: h.yaw,
                        type: 'custom', text: h.label || '', id: hsId,
                        createTooltipFunc: makeTooltip,
                        createTooltipArgs: { gif, hotspotDbId: h.id, size: hotspotSize, label: h.label || '' },
                    })
                } catch {}
            }
        }
    }, [hotspots, activeScene, makeTooltip, editingId, hotspotSize])

    // ── rAF — keeps pin projected on screen ───────────────────────────────
    const mainLoop = useCallback(() => {
        // While the preview modal is open, stop projecting/setting state every
        // frame — it would re-render the editor (and the modal) needlessly.
        if (previewOpenRef.current) { rafRef.current = requestAnimationFrame(mainLoop); return }

        const viewer = pannellumRef.current, el = viewerRef.current
        const ps     = popupRef.current

        let pitch, yaw
        if      (ps?.mode === 'new' || ps?.mode === 'edit-existing')  { pitch = ps.pitch;          yaw = ps.yaw          }
        else if (ps?.mode === 'confirm-edit' || ps?.mode === 'saved') { pitch = ps.hotspot?.pitch;  yaw = ps.hotspot?.yaw }

        if (viewer && el && pitch != null && yaw != null) {
            const { clientWidth: W, clientHeight: H } = el
            setPinPos(pitchYawToScreen(pitch, yaw, viewer.getPitch(), viewer.getYaw(), viewer.getHfov(), W, H))
        } else {
            setPinPos(null)
        }
        rafRef.current = requestAnimationFrame(mainLoop)
    }, []) // eslint-disable-line

    useEffect(() => {
        rafRef.current = requestAnimationFrame(mainLoop)
        return () => cancelAnimationFrame(rafRef.current)
    }, [mainLoop])

    // ── sampleAt — screen → sphere coords ─────────────────────────────────
    const sampleAt = useCallback((clientX, clientY) => {
        const viewer = pannellumRef.current, el = viewerRef.current
        if (!viewer || !el) return null
        const { left, top, width, height } = el.getBoundingClientRect()
        return screenToPitchYaw(clientX - left, clientY - top, viewer.getPitch(), viewer.getYaw(), viewer.getHfov(), width, height)
    }, [])

    // ── Drag / drop ────────────────────────────────────────────────────────
    const onViewerDragOver = useCallback(e => { e.preventDefault(); setIsDragOver(true) }, [])
    const onViewerDrop     = useCallback(e => {
        e.preventDefault(); setIsDragOver(false)
        const sceneData   = e.dataTransfer.getData('scene')
        const hotspotType = e.dataTransfer.getData('hotspot-type')
        if (sceneData) { setActiveScene(JSON.parse(sceneData)); return }
        if (hotspotType) {
            const coords = sampleAt(e.clientX, e.clientY)
            if (!coords) return
            setPopupState({ mode: 'new', arrow_type: hotspotType, ...coords, label: '', target_scene_id: '' })
        }
    }, [sampleAt])

    const onOverlayMouseMove = useCallback(e => {
        if (!isDraggingPin) return
        const coords = sampleAt(e.clientX, e.clientY)
        if (coords) setPopupState(prev =>
            (prev?.mode === 'new' || prev?.mode === 'edit-existing') ? { ...prev, ...coords } : prev
        )
    }, [isDraggingPin, sampleAt])

    // ── Logo drag (screen-space, percent of viewer) ────────────────────────
    function onLogoMouseDown(e) {
        const el = viewerRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const cx = rect.left + (logoPos.x / 100) * rect.width
        const cy = rect.top  + (logoPos.y / 100) * rect.height
        logoDragRef.current = { offX: e.clientX - cx, offY: e.clientY - cy }
        setDraggingLogo(true)
        e.preventDefault(); e.stopPropagation()
    }

    // Keep the WHOLE logo inside the viewer (account for its half width/height,
    // not just its center) so it can never spill off — and shrink — past an edge.
    function clampLogoToFrame(xPct, yPct, rect) {
        const w = logoImgRef.current?.offsetWidth  || logoSize
        const h = logoImgRef.current?.offsetHeight || logoSize
        const halfW = rect.width  ? (w / 2 / rect.width)  * 100 : 0
        const halfH = rect.height ? (h / 2 / rect.height) * 100 : 0
        // If the logo is wider/taller than the frame, just centre that axis.
        const x = halfW * 2 >= 100 ? 50 : Math.min(100 - halfW, Math.max(halfW, xPct))
        const y = halfH * 2 >= 100 ? 50 : Math.min(100 - halfH, Math.max(halfH, yPct))
        return { x, y }
    }

    function onLogoMove(e) {
        const el = viewerRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const { offX, offY } = logoDragRef.current || { offX: 0, offY: 0 }
        const rawX = ((e.clientX - offX - rect.left) / rect.width)  * 100
        const rawY = ((e.clientY - offY - rect.top)  / rect.height) * 100
        const { x, y } = clampLogoToFrame(rawX, rawY, rect)
        setLogoPos({ x: roundTo2(x), y: roundTo2(y) })
    }

    function onLogoUp() {
        setDraggingLogo(false)
        saveLogoPos(logoPos)
    }

    // Style for the on-screen logo: fixed width (so it never shrink-to-fits near an
    // edge) and a clamped position (so even previously-saved values stay visible).
    function logoDisplayStyle() {
        const w = logoImgRef.current?.offsetWidth  || logoSize
        const h = logoImgRef.current?.offsetHeight || logoSize
        const halfW = viewerSize.w ? (w / 2 / viewerSize.w) * 100 : 0
        const halfH = viewerSize.h ? (h / 2 / viewerSize.h) * 100 : 0
        const x = halfW * 2 >= 100 ? 50 : Math.min(100 - halfW, Math.max(halfW, logoPos.x))
        const y = halfH * 2 >= 100 ? 50 : Math.min(100 - halfH, Math.max(halfH, logoPos.y))
        return { left: `${x}%`, top: `${y}%`, width: `${logoSize}px`, transform: 'translate(-50%,-50%)' }
    }

    async function saveLogoPos(pos) {
        if (!project) return
        try {
            const res = await fetch(`/api/projects/${project.id}`, {
                method: 'PATCH', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ logo_x: roundTo2(pos.x), logo_y: roundTo2(pos.y) }),
            })
            if (res.ok) { const { project: updated } = await res.json(); setProject(updated) }
        } catch {}
    }

    async function saveLogoSize(size) {
        if (!project) return
        try {
            const res = await fetch(`/api/projects/${project.id}`, {
                method: 'PATCH', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ logo_size: Math.round(size) }),
            })
            if (res.ok) { const { project: updated } = await res.json(); setProject(updated) }
        } catch {}
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

    async function deleteHotspot(id) {
        await fetch(`/api/hotspots/${id}`, { method: 'DELETE' })
        setHotspots(prev => prev.filter(h => h.id !== id))
        if (popupState?.hotspot?.id === id) setPopupState(null)
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
        setPreviewHtml(buildTourHtml({ project, scenes, hotspots }))
    }

    function exportToHtml() {
        if (!scenes.length || !project) return
        dispatchFlag('exporting')
        try {
            const html = buildTourHtml({ project, scenes, hotspots })
            const a = Object.assign(document.createElement('a'), {
                href:     URL.createObjectURL(new Blob([html], { type:'text/html;charset=utf-8' })),
                download: `${project.name.replace(/[^a-z0-9]/gi,'_').toLowerCase()}_360tour.html`,
            })
            document.body.appendChild(a); a.click(); document.body.removeChild(a)
            URL.revokeObjectURL(a.href)
        } finally { dispatchFlag('exporting') }
    }

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-[#FAFAF7]">
            <Spinner size={20}/>
        </div>
    )

    const hasPopup  = popupState !== null
    const isEditing = popupState?.mode === 'new' || popupState?.mode === 'edit-existing'

    return (
        <>
            <style>{PANNELLUM_STYLES}</style>
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
                        onClick={() => { setSettingsDraft({ logo_url: project?.logo_url||'', show_intro: project?.show_intro??true, auto_rotate: project?.auto_rotate??-3 }); setShowSettings(true) }}
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

                    {/* Export */}
                    <button onClick={exportToHtml} disabled={flags.exporting || !scenes.length}
                            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#3730a3] text-white text-[12px] font-semibold hover:bg-[#312e81] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
                        {flags.exporting
                            ? <><Spinner/>Exporting…</>
                            : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export HTML</>}
                    </button>
                </header>

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

                                {/* Logo watermark — fixed on screen, draggable + sizable.
                                    Position stored as percent (logo_x/logo_y); width in px (logo_size). */}
                                {project?.logo_url && (
                                    <div className="absolute z-20 pointer-events-none"
                                         style={logoDisplayStyle()}>
                                        <img src={project.logo_url} alt="logo" draggable={false}
                                             ref={logoImgRef}
                                             onMouseDown={onLogoMouseDown}
                                             onLoad={() => setLogoPos(p => ({ ...p }))}
                                             style={{ pointerEvents: 'auto', width: '100%', height: 'auto', display: 'block' }}
                                             className={`opacity-90 select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] ${draggingLogo ? 'cursor-grabbing' : 'cursor-grab'}`}/>
                                    </div>
                                )}

                                {/* Capture surface while dragging the logo */}
                                {draggingLogo && (
                                    <div className="absolute inset-0 z-40 cursor-grabbing"
                                         onMouseMove={onLogoMove}
                                         onMouseUp={onLogoUp}
                                         onMouseLeave={onLogoUp}/>
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
                                {draggingLogo && (
                                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-black/65 backdrop-blur text-white text-[11px] font-medium px-3 py-1.5 rounded-full">
                                        Drag the logo · release to fix its place
                                    </div>
                                )}

                                <CameraControls pannellumRef={pannellumRef}/>
                            </>
                        )}
                    </div>

                    {/* Right — directions */}
                    <div className="w-[200px] shrink-0 relative overflow-hidden">
                        <HotspotPanel scenes={scenes} activeSceneId={activeScene?.id}
                                      hotspots={hotspots} onDeleteHotspot={deleteHotspot}
                                      hotspotSize={hotspotSize}
                                      onHotspotSizeChange={setHotspotSize}
                                      onHotspotSizeCommit={saveHotspotSize}
                                      logoUrl={project?.logo_url} logoSize={logoSize}
                                      onLogoSizeChange={setLogoSize}
                                      onLogoSizeCommit={saveLogoSize}/>
                    </div>
                </div>
            </div>

            {showSettings && settingsDraft && (
                <SettingsModal draft={settingsDraft} onChange={setSettingsDraft}
                               onSave={saveSettings} onClose={() => setShowSettings(false)}
                               saving={flags.savingSettings} projectId={projectId}
                               onProjectChange={setProject}/>
            )}
            {confirmDelete && (
                <DeleteModal projectName={project?.name} onConfirm={deleteProject}
                             onClose={() => setConfirmDelete(false)} deleting={flags.deleting}/>
            )}
            {previewHtml && (
                <TourPreviewModal html={previewHtml} projectName={project?.name}
                                  onClose={() => { previewOpenRef.current = false; setPreviewHtml(null) }}/>
            )}
        </>
    )
}

const PANNELLUM_STYLES = `
.pnlm-hotspot-base { cursor: pointer !important; background: none !important; border: none !important; }
.pnlm-context-menu, .pnlm-load-box, .pnlm-about-msg { display: none !important; }
`