'use client'
// components/360editor/project/panel_tabs.jsx
//
// Tab bar for the right-hand panel. Directions/Overlays/Zones used to be
// three sections hard-stacked in one column (a flexible one plus two fixed
// 220px blocks) — that stacking is what silently clipped the arrow palette
// once the column ran out of vertical room. Now only one section mounts at a
// time, chosen here; middle.jsx owns which one, same as the rest of its UI
// state.
export default function PanelTabs({ tabs, active, onChange }) {
    return (
        <div className="h-9 shrink-0 flex bg-editor-panel border-b border-editor-border">
            {tabs.map(tab => {
                const isActive = tab.key === active
                return (
                    <button
                        key={tab.key}
                        onClick={() => onChange(tab.key)}
                        className={`relative flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold transition-colors ${
                            isActive ? 'text-editor-primary' : 'text-editor-ink-muted hover:text-editor-ink'
                        }`}
                    >
                        {tab.label}
                        {tab.count > 0 && (
                            <span className={isActive ? 'text-[9px] text-editor-primary/70' : 'text-[9px] text-editor-ink-dim'}>
                                {tab.count}
                            </span>
                        )}
                        {tab.dot && <span className="w-1.5 h-1.5 rounded-full bg-editor-primary"/>}
                        {isActive && <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-editor-primary"/>}
                    </button>
                )
            })}
        </div>
    )
}
