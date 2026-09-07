'use client'
// ─────────────────────────────────────────
// LEFT PANEL — Scene Manager
// Import, name, upload & delete 360° images
// ─────────────────────────────────────────
// components/360editor/project/scene_panel.jsx
//
// No Supabase client on the client side. Upload flow (per file):
//   1. POST /api/scenes/upload-url  → server checks ownership + limits, returns { path, signedUrl }
//   2. browser PUTs the file straight to signedUrl (plain fetch, no SDK, no 4.5MB route limit)
//   3. POST /api/scenes             → server inserts the scene row, returns the scene
// Delete goes through DELETE /api/scenes/[id] (storage + row, ownership-checked).
//
// Import accepts multiple files at once and auto-saves each the moment its
// own upload finishes — no more "select one, type a name, click Save,
// repeat" per panorama. A small worker pool (MAX_CONCURRENT_UPLOADS) runs
// several of these 3-step sequences at a time rather than fully serially
// (slow for a big batch) or fully in parallel (equirectangular panoramas run
// up to 50MB each — many at once just splits the same upload bandwidth
// thinner per file instead of finishing any faster, and risks the browser/
// server juggling dozens of large in-flight PUTs at once). 3 concurrent is
// the same kind of small-worker-pool balance most chunked/parallel upload
// tools default to for large files on an ordinary connection.
import { useRef, useState, useEffect } from 'react'

const MAX_BYTES  = 50 * 1024 * 1024   // mirror the server cap for fast feedback
const MAX_SCENES = 30                 // mirrors the server's per-project cap (see app/api/scenes/upload-url/route.js)
const MAX_CONCURRENT_UPLOADS = 3

let queueIdSeq = 0

export default function ScenePanel({ projectId, scenes, onScenesChange, onSelectScene, activeSceneId }) {
    const fileInputRef = useRef(null)
    const [queue, setQueue] = useState([])  // [{id, file, name, preview, status: 'queued'|'uploading'|'error', error}]
    const [confirmDelete, setConfirmDelete] = useState(null)
    const [error, setError] = useState('')

    // Mirrors `scenes` for reads inside async upload completions, but ALSO
    // gets written to synchronously the instant a scene is created (before
    // onScenesChange/setState round-trips back down as a new prop) — two
    // uploads can finish back-to-back well within one React render, and
    // without this, the second one's [...scenesRef.current, itsOwnScene]
    // would still be building off the array from BEFORE the first one's
    // scene existed, silently dropping the first from the visible list the
    // moment the second's onScenesChange call landed (it created fine
    // server-side, it just wouldn't show up in the UI).
    const scenesRef = useRef(scenes)
    scenesRef.current = scenes
    const queueRef = useRef(queue)
    queueRef.current = queue
    const activeUploadsRef = useRef(0)

    function onFileChange(e) {
        const files = Array.from(e.target.files || [])
        e.target.value = ''
        if (!files.length) return
        setError('')

        const roomLeft = MAX_SCENES - scenesRef.current.length - queueRef.current.length
        if (roomLeft <= 0) { setError(`Limit of ${MAX_SCENES} scenes per project reached.`); return }

        const accepted = []
        let skippedBad = 0
        for (const file of files) {
            if (accepted.length >= roomLeft) break
            if (!file.type.startsWith('image/') || file.size > MAX_BYTES) { skippedBad++; continue }
            accepted.push(file)
        }
        const skippedForRoom = files.length - accepted.length - skippedBad
        if (skippedBad > 0 || skippedForRoom > 0) {
            setError(
                skippedForRoom > 0
                    ? `Only ${roomLeft} more scene${roomLeft === 1 ? '' : 's'} fit in this project (limit ${MAX_SCENES}) — the rest were skipped.`
                    : 'Some files were skipped (not an image, or over 50 MB).'
            )
        }
        if (!accepted.length) return

        const items = accepted.map(file => ({
            id: `q${++queueIdSeq}`,
            file,
            name: file.name.replace(/\.[^.]+$/, '') || 'Untitled',
            preview: URL.createObjectURL(file),
            status: 'queued',
            error: '',
        }))
        setQueue(prev => [...prev, ...items])
    }

    // Starts queued items up to whatever room MAX_CONCURRENT_UPLOADS has
    // left, every time `queue` changes — new files queued, or a slot freed
    // up by an upload finishing (success, failure, or a retry re-queuing
    // one). This runs as an effect rather than being called directly after
    // each setQueue (from onFileChange, uploadOne's finally, retryItem)
    // because queueRef only gets refreshed at render time: calling it
    // synchronously right after a setQueue would still read the PRE-update
    // ref, and on the very first import (nothing else about to force a
    // render) that meant nothing ever actually started uploading.
    useEffect(() => {
        const freeSlots = MAX_CONCURRENT_UPLOADS - activeUploadsRef.current
        if (freeSlots <= 0) return
        queue.filter(q => q.status === 'queued').slice(0, freeSlots).forEach(uploadOne)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queue])

    async function uploadOne(item) {
        activeUploadsRef.current++
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading' } : q))
        try {
            const urlRes = await fetch('/api/scenes/upload-url', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId, filename: item.file.name, contentType: item.file.type, size: item.file.size,
                }),
            })
            const urlData = await urlRes.json().catch(() => ({}))
            if (!urlRes.ok) throw new Error(urlData?.error || 'Could not start upload.')

            const putRes = await fetch(urlData.signedUrl, {
                method: 'PUT', headers: { 'Content-Type': item.file.type }, body: item.file,
            })
            if (!putRes.ok) throw new Error('Upload to storage failed.')

            const recRes = await fetch('/api/scenes', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, name: item.name, storage_path: urlData.path }),
            })
            const recData = await recRes.json().catch(() => ({}))
            if (!recRes.ok) throw new Error(recData?.error || 'Could not save scene.')

            scenesRef.current = [...scenesRef.current, recData.scene] // see the comment on scenesRef above
            onScenesChange(scenesRef.current)
            URL.revokeObjectURL(item.preview)
            setQueue(prev => prev.filter(q => q.id !== item.id))
        } catch (e) {
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: e.message || 'Upload failed' } : q))
        } finally {
            // Decrementing this frees a slot; the effect above notices the
            // setQueue calls above it (both branches call one) and re-pumps
            // with this decremented count on its own — see that effect's
            // comment for why a direct pump() call here would be unsafe.
            activeUploadsRef.current--
        }
    }

    function retryItem(id) {
        setQueue(prev => prev.map(q => q.id === id ? { ...q, status: 'queued', error: '' } : q))
    }

    function dismissItem(id) {
        setQueue(prev => {
            const item = prev.find(q => q.id === id)
            if (item) URL.revokeObjectURL(item.preview)
            return prev.filter(q => q.id !== id)
        })
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
        <aside className="flex flex-col h-full bg-editor-panel border-r border-editor-border select-none">
            {/* Header */}
            <div className="px-3 py-3 border-b border-editor-border">
                <p className="text-[11px] font-bold uppercase tracking-widest text-editor-ink-muted">Scenes</p>
            </div>

            {/* Upload trigger */}
            <div className="px-3 py-3 border-b border-editor-border">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-9 rounded-lg border border-dashed border-editor-primary/40 text-[12px] font-semibold text-editor-primary hover:bg-editor-primary/5 transition-colors flex items-center justify-center gap-1.5"
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                    Import Images
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFileChange} />
            </div>

            {/* Import queue — each row auto-saves on its own the moment its
                upload finishes and then disappears (the scene shows up in
                the list below); an errored row stays put with Retry/Dismiss
                so a failed panorama in a big batch doesn't just vanish. */}
            {queue.length > 0 && (
                <div className="px-2 py-2 border-b border-editor-border space-y-1 max-h-[45%] overflow-y-auto">
                    {queue.map(item => (
                        <div key={item.id} className="flex items-center gap-2 px-1.5 py-1.5 rounded-lg bg-editor-surface">
                            <img src={item.preview} alt="" className="w-8 h-8 rounded object-cover shrink-0"/>
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-semibold text-editor-ink truncate">{item.name}</p>
                                <p className={`text-[10px] truncate ${item.status === 'error' ? 'text-red-500' : 'text-editor-ink-muted'}`}>
                                    {item.status === 'queued' && 'Queued…'}
                                    {item.status === 'uploading' && 'Uploading…'}
                                    {item.status === 'error' && (item.error || 'Upload failed')}
                                </p>
                            </div>
                            {item.status === 'error' ? (
                                <div className="flex gap-1 shrink-0">
                                    <button onClick={() => retryItem(item.id)}
                                            className="h-6 px-2 text-[10px] font-semibold rounded-md bg-editor-primary text-white hover:bg-editor-primary-hover transition-colors">
                                        Retry
                                    </button>
                                    <button onClick={() => dismissItem(item.id)}
                                            className="h-6 px-2 text-[10px] font-semibold rounded-md border border-editor-border text-editor-ink-muted hover:bg-editor-subtle transition-colors">
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                <svg className="animate-spin shrink-0 text-editor-primary" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                </svg>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Scene list */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
                {scenes.length === 0 && queue.length === 0 && (
                    <p className="text-[11px] text-editor-ink-muted text-center mt-6 px-3">No scenes yet. Import a 360° image to begin.</p>
                )}
                {error && (
                    <p className="text-red-500 text-[11px] text-center px-3">{error}</p>
                )}
                {scenes.map(scene => (
                    <div
                        key={scene.id}
                        draggable
                        onDragStart={e => e.dataTransfer.setData('scene', JSON.stringify(scene))}
                        onDoubleClick={() => onSelectScene?.(scene)}
                        title="Drag onto the viewer, or double-click to open"
                        className={`group relative rounded-lg overflow-hidden border hover:shadow-[0_2px_10px_rgba(55,48,163,0.08)] cursor-grab active:cursor-grabbing transition-all ${
                            scene.id === activeSceneId ? 'border-editor-primary ring-2 ring-editor-primary/30' : 'border-editor-border hover:border-editor-primary/40'
                        }`}
                    >
                        <img src={scene.url} alt={scene.name} className="w-full h-[68px] object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                            <p className="text-[11px] font-semibold text-white truncate">{scene.name}</p>
                        </div>
                        <button
                            onClick={e => { e.stopPropagation(); setConfirmDelete(scene) }}
                            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 w-5 h-5 bg-white/80 rounded flex items-center justify-center text-editor-ink-muted hover:text-red-500 hover:bg-red-50 transition-all"
                        >
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                    </div>
                ))}
            </div>

            {/* Delete confirmation modal */}
            {confirmDelete && (
                <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-editor-border rounded-xl p-5 w-full max-w-[220px] shadow-xl">
                        <p className="text-[13px] font-semibold text-editor-ink mb-1">Delete scene?</p>
                        <p className="text-[11px] text-editor-ink-muted mb-4">"{confirmDelete.name}" will be permanently removed.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmDelete(null)} className="flex-1 h-8 text-[12px] rounded-lg border border-editor-border text-editor-ink-muted hover:bg-editor-subtle transition-colors">Cancel</button>
                            <button onClick={() => deleteScene(confirmDelete)} className="flex-1 h-8 text-[12px] rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    )
}
