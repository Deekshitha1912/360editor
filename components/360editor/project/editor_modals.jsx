'use client'
// components/360editor/project/editor_modals.jsx
// Small shared UI + modal dialogs used by the editor (middle.jsx).

export function Spinner({ size = 12 }) {
    return (
        <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24"
             fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
    )
}

export function CameraControls({ pannellumRef }) {
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

// Logo upload used to live here, writing straight to projects.logo_url. That
// column is gone — a project can carry several logos plus per-scene cover-ups
// now, all managed in OverlayPanel. This modal is back to what its name says:
// project settings.
export function SettingsModal({ draft, onChange, onSave, onClose, saving }) {

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl border border-[#E2E2DA] shadow-2xl p-6 w-[360px] space-y-4">
                <p className="text-[14px] font-semibold text-[#1a1a18]">Project settings</p>

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
                    <button onClick={onSave} disabled={saving}
                            className="flex-1 h-9 text-[12px] rounded-xl bg-[#3730a3] text-white font-semibold hover:bg-[#312e81] disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
                        {saving ? <><Spinner/>Saving…</> : 'Save settings'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export function DeleteModal({ projectName, onConfirm, onClose, deleting }) {
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

export function HotspotDeleteModal({ hotspot, targetName, onConfirm, onClose, deleting }) {
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
                        <p className="text-[14px] font-semibold text-[#1a1a18]">Delete this hotspot?</p>
                        <p className="text-[11px] text-[#6b6b60] mt-0.5">
                            {hotspot?.label ? `"${hotspot.label}"` : 'This arrow'}
                            {targetName ? ` (goes to ${targetName})` : ''} will be removed from this scene.
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
                        {deleting ? <><Spinner/>Deleting…</> : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    )
}