'use client'
// components/360editor/project/hotspot_panel.jsx
// RIGHT PANEL — arrow palette + hotspot size + logo size + saved hotspots list
// The pending hotspot editor is a floating popup on the viewer (middle.jsx)

const STORAGE = 'https://dtmbvliwbvnjnewkohcn.supabase.co/storage/v1/object/public/hotspots'

export const ARROWS = [
    { type: 'up',       jpg: `${STORAGE}/arrow_up.jpg`,       gif: `${STORAGE}/arrow_up.gif`,       label: 'Forward' },
    { type: 'left',     jpg: `${STORAGE}/arrow_left.jpg`,     gif: `${STORAGE}/arrow_left.gif`,     label: 'Left'    },
    { type: 'up-left',  jpg: `${STORAGE}/arrow_left_up.jpg`,  gif: `${STORAGE}/arrow_left_up.gif`,  label: 'Fwd-L'   },
    { type: 'up-right', jpg: `${STORAGE}/arrow_right_up.jpg`, gif: `${STORAGE}/arrow_right_up.gif`, label: 'Fwd-R'   },
]

export default function HotspotPanel({
                                         scenes,
                                         activeSceneId,
                                         hotspots,
                                         onDeleteHotspot,
                                         hotspotSize = 90,
                                         onHotspotSizeChange,
                                         onHotspotSizeCommit,
                                         logoUrl,
                                         logoSize = 160,
                                         onLogoSizeChange,
                                         onLogoSizeCommit,
                                     }) {
    const sceneHotspots = hotspots.filter(h => h.scene_id === activeSceneId)

    return (
        <aside className="flex flex-col h-full bg-white border-l border-[#E2E2DA] select-none">

            {/* ── Header ── */}
            <div className="px-4 py-3 border-b border-[#E2E2DA]">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#6b6b60]">Directions</p>
                <p className="text-[10px] text-[#6b6b60] mt-0.5">Drag an arrow onto the viewer</p>
            </div>

            {/* ── Arrow drag palette ── */}
            <div className="px-3 py-3 border-b border-[#E2E2DA]">
                <p className="text-[10px] uppercase tracking-widest text-[#6b6b60] mb-2">Drag to place</p>
                <div className="grid grid-cols-2 gap-1.5">
                    {ARROWS.map(arrow => (
                        <div
                            key={arrow.type}
                            draggable
                            onDragStart={e => e.dataTransfer.setData('hotspot-type', arrow.type)}
                            className="flex flex-col items-center gap-1 p-1.5 rounded-lg border border-[#E2E2DA] hover:border-[#3730a3]/40 hover:bg-[#3730a3]/5 cursor-grab active:cursor-grabbing transition-colors group"
                            title={arrow.label}
                        >
                            <img src={arrow.jpg} alt={arrow.label} className="w-8 h-8 object-contain" draggable={false}/>
                            <span className="text-[9px] text-[#6b6b60] group-hover:text-[#3730a3]">{arrow.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Hotspot size (one common size for all arrows in this tour) ── */}
            <div className="px-3 py-3 border-b border-[#E2E2DA]">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-widest text-[#6b6b60]">Hotspot size</p>
                    <span className="text-[10px] text-[#6b6b60] font-mono">{hotspotSize}px</span>
                </div>
                <input
                    type="range" min="40" max="400" step="5" value={hotspotSize}
                    onChange={e => onHotspotSizeChange?.(parseInt(e.target.value, 10) || 90)}
                    onMouseUp={e => onHotspotSizeCommit?.(parseInt(e.target.value, 10) || 90)}
                    onTouchEnd={e => onHotspotSizeCommit?.(parseInt(e.target.value, 10) || 90)}
                    className="w-full accent-[#3730a3] cursor-pointer"
                />
                <p className="text-[9px] text-[#6b6b60] mt-1">Applies to every direction arrow in the tour.</p>
            </div>

            {/* ── Logo size (only when a logo has been uploaded) ── */}
            {logoUrl && (
                <div className="px-3 py-3 border-b border-[#E2E2DA]">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] uppercase tracking-widest text-[#6b6b60]">Logo size</p>
                        <span className="text-[10px] text-[#6b6b60] font-mono">{logoSize}px</span>
                    </div>
                    <input
                        type="range" min="60" max="400" step="5" value={logoSize}
                        onChange={e => onLogoSizeChange?.(parseInt(e.target.value, 10) || 160)}
                        onMouseUp={e => onLogoSizeCommit?.(parseInt(e.target.value, 10) || 160)}
                        onTouchEnd={e => onLogoSizeCommit?.(parseInt(e.target.value, 10) || 160)}
                        className="w-full accent-[#3730a3] cursor-pointer"
                    />
                    <p className="text-[9px] text-[#6b6b60] mt-1">Drag the logo on the viewer to reposition it.</p>
                </div>
            )}

            {/* ── Saved hotspots list ── */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
                {sceneHotspots.length === 0 && (
                    <p className="text-[11px] text-[#6b6b60] text-center mt-6 px-2 leading-relaxed">
                        No directions yet.<br/>Drag an arrow onto the viewer.
                    </p>
                )}
                {sceneHotspots.map(h => {
                    const target = scenes.find(s => s.id === h.target_scene_id)
                    const arrow  = ARROWS.find(a => a.type === h.arrow_type)
                    return (
                        <div key={h.id}
                             className="group flex items-center gap-2 px-2 py-2 rounded-lg border border-[#E2E2DA] hover:border-[#3730a3]/30 hover:bg-[#FAFAF7] transition-colors">
                            <img src={arrow?.jpg} alt={arrow?.label} className="w-6 h-6 object-contain shrink-0"/>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold text-[#1a1a18] truncate">{h.label || 'Untitled'}</p>
                                <p className="text-[10px] text-[#6b6b60] truncate">→ {target?.name || 'Unknown'}</p>
                            </div>
                            <button
                                onClick={() => onDeleteHotspot(h.id)}
                                aria-label="Delete hotspot"
                                className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-[#6b6b60] hover:text-red-500 transition-all shrink-0"
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