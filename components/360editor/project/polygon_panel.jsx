'use client'
// components/360editor/project/polygon_panel.jsx
//
// A LIST, not an editor — mirrors overlay_panel.jsx. Each zone is one row
// (color swatch instead of a thumbnail, since a polygon has no image of its
// own). Clicking a row opens its detail card on the shape itself in the
// viewer, same "jump to it" affordance as the logo/cover-up panel.
import { colorForStatus } from '@/lib/polygons'

function Row({ item, selected, onSelect, onDelete }) {
    return (
        <div
            onClick={() => onSelect(item.id)}
            className={`group flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                selected ? 'border-editor-primary bg-editor-primary/[0.04]' : 'border-editor-border bg-white hover:border-editor-primary/40'
            }`}
        >
            <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: colorForStatus(item.status) }}/>
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

export default function PolygonPanel({ polygons, selectedId, activeSceneId, drawing, onStartDraw, onSelect, onDelete }) {
    return (
        <div className="flex flex-col h-full bg-editor-panel border-l border-editor-border overflow-hidden">

            <div className="px-3 py-3 shrink-0">
                <div className="text-[11px] font-bold uppercase tracking-widest text-editor-ink-muted">Zones</div>
                <p className="text-[10px] text-editor-ink-dim mt-0.5">Draw a shape, then set its status.</p>
            </div>

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
