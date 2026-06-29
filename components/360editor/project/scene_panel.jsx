'use client'
// ─────────────────────────────────────────
// LEFT PANEL — Scene Manager
// Import, name, upload & delete 360° images
// ─────────────────────────────────────────
// components/360editor/project/scene_panel.jsx
//
// No Supabase client on the client side. Upload flow:
//   1. POST /api/scenes/upload-url  → server checks ownership + limits, returns { path, signedUrl }
//   2. browser PUTs the file straight to signedUrl (plain fetch, no SDK, no 4.5MB route limit)
//   3. POST /api/scenes             → server inserts the scene row, returns the scene
// Delete goes through DELETE /api/scenes/[id] (storage + row, ownership-checked).
import { useRef, useState } from 'react'

const MAX_BYTES = 50 * 1024 * 1024   // mirror the server cap for fast feedback

export default function ScenePanel({ projectId, scenes, onScenesChange }) {
    const fileInputRef = useRef(null)
    const [uploading, setUploading] = useState(false)
    const [pendingName, setPendingName] = useState('')
    const [pendingFile, setPendingFile] = useState(null)
    const [pendingPreview, setPendingPreview] = useState(null)
    const [confirmDelete, setConfirmDelete] = useState(null)
    const [error, setError] = useState('')

    function onFileChange(e) {
        const file = e.target.files?.[0]
        if (!file) return
        setError('')
        if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); e.target.value = ''; return }
        if (file.size > MAX_BYTES)           { setError('Image must be 50 MB or smaller.'); e.target.value = ''; return }
        setPendingFile(file)
        setPendingName(file.name.replace(/\.[^.]+$/, ''))
        setPendingPreview(URL.createObjectURL(file))
        e.target.value = ''
    }

    async function uploadScene() {
        if (!pendingFile || !pendingName.trim()) return
        setUploading(true)
        setError('')
        try {
            // 1) Ask the server for a signed upload URL (authorizes + enforces limits)
            const urlRes = await fetch('/api/scenes/upload-url', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    filename:    pendingFile.name,
                    contentType: pendingFile.type,
                    size:        pendingFile.size,
                }),
            })
            const urlData = await urlRes.json().catch(() => ({}))
            if (!urlRes.ok) throw new Error(urlData?.error || 'Could not start upload.')

            // 2) Upload the file straight to storage — plain fetch PUT, no Supabase SDK.
            //    The token in signedUrl authorizes the write; no auth header needed.
            const putRes = await fetch(urlData.signedUrl, {
                method: 'PUT',
                headers: { 'Content-Type': pendingFile.type },
                body: pendingFile,
            })
            if (!putRes.ok) throw new Error('Upload to storage failed.')

            // 3) Create the scene row server-side
            const recRes = await fetch('/api/scenes', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, name: pendingName.trim(), storage_path: urlData.path }),
            })
            const recData = await recRes.json().catch(() => ({}))
            if (!recRes.ok) throw new Error(recData?.error || 'Could not save scene.')

            onScenesChange([...scenes, recData.scene])
            setPendingFile(null)
            setPendingName('')
            setPendingPreview(null)
        } catch (e) {
            setError(e.message || 'Upload failed')
        } finally {
            setUploading(false)
        }
    }

    async function deleteScene(scene) {
        setError('')
        try {
            const res = await fetch(`/api/scenes/${scene.id}`, { method: 'DELETE' })
            if (!res.ok) {
                const d = await res.json().catch(() => ({}))
                throw new Error(d?.error || 'Delete failed')
            }
            onScenesChange(scenes.filter(s => s.id !== scene.id))
        } catch (e) {
            setError(e.message || 'Delete failed')
        } finally {
            setConfirmDelete(null)
        }
    }

    return (
        <aside className="flex flex-col h-full bg-white border-r border-[#E2E2DA] select-none">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#E2E2DA]">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#6b6b60]">Scenes</p>
            </div>

            {/* Upload trigger */}
            <div className="px-3 py-3 border-b border-[#E2E2DA]">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-9 rounded-lg border border-dashed border-[#3730a3]/40 text-[12px] font-semibold text-[#3730a3] hover:bg-[#3730a3]/5 transition-colors flex items-center justify-center gap-1.5"
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                    Import Image
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
            </div>

            {/* Name + confirm upload */}
            {pendingFile && (
                <div className="px-3 py-3 border-b border-[#E2E2DA] space-y-2">
                    {pendingPreview && (
                        <img src={pendingPreview} alt="" className="w-full h-[80px] object-cover rounded-lg" />
                    )}
                    <input
                        value={pendingName}
                        onChange={e => setPendingName(e.target.value)}
                        placeholder="Scene name"
                        className="w-full h-8 bg-[#FAFAF7] border border-[#E2E2DA] rounded-lg px-2.5 text-[12px] text-[#1a1a18] focus:outline-none focus:border-[#3730a3] placeholder:text-[#6b6b60]"
                    />
                    {error && <p className="text-red-500 text-[11px]">{error}</p>}
                    <div className="flex gap-1.5">
                        <button
                            onClick={() => { setPendingFile(null); setPendingName(''); setPendingPreview(null); setError('') }}
                            className="flex-1 h-7 text-[11px] rounded-md border border-[#E2E2DA] text-[#6b6b60] hover:bg-[#F4F4EF] transition-colors"
                        >Cancel</button>
                        <button
                            onClick={uploadScene}
                            disabled={uploading || !pendingName.trim()}
                            className="flex-1 h-7 text-[11px] rounded-md bg-[#3730a3] text-white font-semibold hover:bg-[#312e81] disabled:opacity-40 transition-colors"
                        >{uploading ? 'Uploading…' : 'Save'}</button>
                    </div>
                </div>
            )}

            {/* Scene list */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
                {scenes.length === 0 && (
                    <p className="text-[11px] text-[#6b6b60] text-center mt-6 px-3">No scenes yet. Import a 360° image to begin.</p>
                )}
                {!pendingFile && error && (
                    <p className="text-red-500 text-[11px] text-center px-3">{error}</p>
                )}
                {scenes.map(scene => (
                    <div
                        key={scene.id}
                        draggable
                        onDragStart={e => e.dataTransfer.setData('scene', JSON.stringify(scene))}
                        className="group relative rounded-lg overflow-hidden border border-[#E2E2DA] hover:border-[#3730a3]/40 hover:shadow-[0_2px_10px_rgba(55,48,163,0.08)] cursor-grab active:cursor-grabbing transition-all"
                    >
                        <img src={scene.url} alt={scene.name} className="w-full h-[68px] object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                            <p className="text-[11px] font-semibold text-white truncate">{scene.name}</p>
                        </div>
                        <button
                            onClick={e => { e.stopPropagation(); setConfirmDelete(scene) }}
                            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 w-5 h-5 bg-white/80 rounded flex items-center justify-center text-[#6b6b60] hover:text-red-500 hover:bg-red-50 transition-all"
                        >
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                    </div>
                ))}
            </div>

            {/* Delete confirmation modal */}
            {confirmDelete && (
                <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-[#E2E2DA] rounded-xl p-5 w-full max-w-[220px] shadow-xl">
                        <p className="text-[13px] font-semibold text-[#1a1a18] mb-1">Delete scene?</p>
                        <p className="text-[11px] text-[#6b6b60] mb-4">"{confirmDelete.name}" will be permanently removed.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmDelete(null)} className="flex-1 h-8 text-[12px] rounded-lg border border-[#E2E2DA] text-[#6b6b60] hover:bg-[#F4F4EF] transition-colors">Cancel</button>
                            <button onClick={() => deleteScene(confirmDelete)} className="flex-1 h-8 text-[12px] rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    )
}