'use client'
// components/360editor/project/logo_overlay.jsx
//
// Logo watermark overlay for the editor viewer.
// Shows the project logo as a draggable hotspot in Pannellum.
// The user can drag it to reposition — pitch/yaw saved to projects table.
//
// Exports:
//   useLogoOverlay(pannellumRef, project, makeLogoTooltip) — hook
//   LogoPin({ pos, pitch, yaw, isDragging, onMouseDown })  — draggable pin
//   LogoPopup({ pos, viewerSize, pitch, yaw, onDone })     — coord card

// ─── useLogoOverlay ───────────────────────────────────────────────────────────
// Manages adding/removing the logo hotspot in Pannellum whenever the viewer
// or project logo changes. Calls makeLogoTooltip to build the DOM element.

import { useEffect } from 'react'

export function useLogoOverlay(pannellumRef, project, activeScene, makeLogoTooltip) {
    useEffect(() => {
        const viewer = pannellumRef.current
        if (!viewer || !activeScene) return

        const LOGO_ID = 'editor_logo'

        // Remove any previously placed logo hotspot
        try { viewer.removeHotSpot(LOGO_ID) } catch {}

        if (!project?.logo_url) return

        const pitch = project.logo_pitch ?? -30
        const yaw   = project.logo_yaw   ?? 0

        try {
            viewer.addHotSpot({
                id: LOGO_ID,
                pitch, yaw,
                type: 'custom',
                text: 'Logo',
                createTooltipFunc: makeLogoTooltip,
                createTooltipArgs: { imageUrl: project.logo_url },
            })
        } catch {}

        return () => {
            try { viewer.removeHotSpot(LOGO_ID) } catch {}
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pannellumRef, project?.logo_url, project?.logo_pitch, project?.logo_yaw, activeScene])
}

// ─── LogoPin ──────────────────────────────────────────────────────────────────
// Draggable placement pin shown over the viewer when the user is repositioning
// the logo. Shows a small logo thumbnail as the handle.

export function LogoPin({ pos, logoUrl, pitch, yaw, isDragging, onMouseDown }) {
    if (!pos) return null
    return (
        <div className="absolute z-30 pointer-events-none"
             style={{ left: pos.x, top: pos.y, transform: 'translate(-50%,-50%)' }}>

            {/* Outer ring */}
            <svg width="56" height="56" viewBox="0 0 56 56"
                 className="absolute pointer-events-none" style={{ left:-28, top:-28 }}>
                <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(0,0,0,.45)" strokeWidth="4"/>
                <circle cx="28" cy="28" r="22" fill="none" stroke="white"           strokeWidth="2.5"/>
                <circle cx="28" cy="28" r="22" fill="none" stroke="#3730a3"         strokeWidth="2" strokeDasharray="5 3"/>
                {/* tick marks */}
                <line x1="28" y1="2"  x2="28" y2="11" stroke="rgba(0,0,0,.45)" strokeWidth="3"/>
                <line x1="28" y1="2"  x2="28" y2="11" stroke="white"           strokeWidth="2"/>
                <line x1="28" y1="2"  x2="28" y2="11" stroke="#3730a3"         strokeWidth="1.5"/>
                <line x1="28" y1="45" x2="28" y2="54" stroke="rgba(0,0,0,.45)" strokeWidth="3"/>
                <line x1="28" y1="45" x2="28" y2="54" stroke="white"           strokeWidth="2"/>
                <line x1="28" y1="45" x2="28" y2="54" stroke="#3730a3"         strokeWidth="1.5"/>
                <line x1="2"  y1="28" x2="11" y2="28" stroke="rgba(0,0,0,.45)" strokeWidth="3"/>
                <line x1="2"  y1="28" x2="11" y2="28" stroke="white"           strokeWidth="2"/>
                <line x1="2"  y1="28" x2="11" y2="28" stroke="#3730a3"         strokeWidth="1.5"/>
                <line x1="45" y1="28" x2="54" y2="28" stroke="rgba(0,0,0,.45)" strokeWidth="3"/>
                <line x1="45" y1="28" x2="54" y2="28" stroke="white"           strokeWidth="2"/>
                <line x1="45" y1="28" x2="54" y2="28" stroke="#3730a3"         strokeWidth="1.5"/>
            </svg>

            {/* Logo thumbnail in the centre */}
            <div className="absolute rounded-full overflow-hidden border-2 border-white shadow-lg bg-white"
                 style={{ width:36, height:36, left:-18, top:-18 }}>
                <img src={logoUrl} alt="logo" className="w-full h-full object-contain p-0.5"/>
            </div>

            {/* Drag handle */}
            <div className="absolute z-10"
                 style={{ width:56, height:56, left:-28, top:-28, pointerEvents:'auto',
                     cursor: isDragging ? 'crosshair' : 'grab' }}
                 onMouseDown={onMouseDown}/>

            {/* Coords badge */}
            <div className="absolute pointer-events-none whitespace-nowrap font-mono text-[10px]
                            font-semibold bg-[#1a1a18]/85 backdrop-blur text-white px-2 py-0.5
                            rounded-full border border-white/10"
                 style={{ bottom:'100%', left:'50%', transform:'translateX(-50%)', marginBottom:38 }}>
                p:{pitch.toFixed(1)}°&nbsp; y:{yaw.toFixed(1)}°
            </div>
        </div>
    )
}

// ─── LogoPopup ────────────────────────────────────────────────────────────────
// Small floating card next to the logo pin.
// Shows current coords and a Done button to save.

export function LogoPopup({ pos, viewerSize, pitch, yaw, saving, onDone, onCancel }) {
    if (!pos) return null

    const POPUP_W = 180
    const POPUP_H = 110
    const GAP     = 28
    const goLeft  = pos.x + GAP + POPUP_W > (viewerSize.w || 800) - 8
    const offsetX = goLeft ? -(GAP + POPUP_W) : GAP

    let offsetY  = -(POPUP_H / 2)
    const absTop = pos.y + offsetY
    if (absTop < 8)                          offsetY = 8 - pos.y
    if (absTop + POPUP_H > (viewerSize.h || 600) - 8) offsetY = (viewerSize.h || 600) - 8 - POPUP_H - pos.y

    return (
        <div className="absolute z-40 pointer-events-auto"
             style={{ left: pos.x + offsetX, top: pos.y + offsetY, width: POPUP_W }}>

            {/* Connector line */}
            <svg className="absolute pointer-events-none overflow-visible"
                 style={{ top: POPUP_H / 2, left: goLeft ? POPUP_W : 0, width: 0, height: 0 }}>
                <line x1="0" y1="0" x2={goLeft ? GAP : -GAP} y2="0"
                      stroke="rgba(55,48,163,0.4)" strokeWidth="1.5" strokeDasharray="3 2"/>
            </svg>

            <div className="bg-white/95 backdrop-blur-md rounded-xl border border-[#E2E2DA]
                            shadow-[0_8px_32px_rgba(0,0,0,0.18)] overflow-hidden">

                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-[#3730a3]/6 border-b border-[#E2E2DA]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                         stroke="#3730a3" strokeWidth="2.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span className="text-[11px] font-bold text-[#3730a3]">Logo position</span>
                </div>

                {/* Coords */}
                <div className="px-3 py-2.5 space-y-2">
                    <div className="flex gap-2">
                        <div className="flex-1 bg-[#F4F4EF] rounded-lg px-2 py-1">
                            <p className="text-[9px] text-[#6b6b60] uppercase tracking-wider">Pitch</p>
                            <p className="text-[11px] font-mono text-[#1a1a18]">{pitch.toFixed(1)}°</p>
                        </div>
                        <div className="flex-1 bg-[#F4F4EF] rounded-lg px-2 py-1">
                            <p className="text-[9px] text-[#6b6b60] uppercase tracking-wider">Yaw</p>
                            <p className="text-[11px] font-mono text-[#1a1a18]">{yaw.toFixed(1)}°</p>
                        </div>
                    </div>
                    <div className="flex gap-1.5">
                        <button onClick={onCancel}
                                className="flex-1 h-7 text-[11px] rounded-lg border border-[#E2E2DA]
                                           text-[#6b6b60] hover:bg-[#F4F4EF] transition-colors">
                            Cancel
                        </button>
                        <button onClick={onDone} disabled={saving}
                                className="flex-1 h-7 text-[11px] rounded-lg bg-[#3730a3] text-white
                                           font-semibold hover:bg-[#312e81] disabled:opacity-40 transition-colors
                                           flex items-center justify-center gap-1">
                            {saving ? (
                                <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24"
                                     fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                </svg>
                            ) : null}
                            {saving ? 'Saving…' : 'Save position'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}