'use client'
// components/360editor/project/editor_modals.jsx
// Small shared UI + modal dialogs used by the editor (middle.jsx).
import { useState, useRef } from 'react'

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

export function SettingsModal({ draft, onChange, onSave, onClose, saving, projectId, onProjectChange }) {
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