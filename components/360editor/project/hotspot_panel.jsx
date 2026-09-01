'use client'
// components/360editor/project/hotspot_panel.jsx
// RIGHT PANEL — arrow palette + saved hotspots list
// The pending hotspot editor is a floating popup on the viewer (middle.jsx)

// ARROWS now lives in lib/arrows.js so the server-rendered public tour route
// can import it too ('use client' exports can't be read from server code).
// Re-exported here so `import HotspotPanel, { ARROWS }` keeps working.
import { ARROWS } from '@/lib/arrows'
export { ARROWS }

export default function HotspotPanel({
                                         scenes,
                                         activeSceneId,
                                         hotspots,
                                         onDeleteHotspot,
                                     }) {
    const sceneHotspots = hotspots.filter(h => h.scene_id === activeSceneId)

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
                             className="group flex items-center gap-2 px-2 py-2 rounded-lg border border-editor-border hover:border-editor-primary/30 hover:bg-editor-canvas transition-colors">
                            <img src={arrow?.gif} alt={arrow?.label} className="w-6 h-6 object-contain shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"/>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold text-editor-ink truncate">{h.label || 'Untitled'}</p>
                                <p className="text-[10px] text-editor-ink-muted truncate">→ {target?.name || 'Unknown'}</p>
                            </div>
                            <button
                                onClick={() => onDeleteHotspot(h.id)}
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