'use client'
// components/360editor/project/editor_modals.jsx
// Small shared UI + modal dialogs used by the editor (middle.jsx).

import { useState } from 'react'

export function Spinner({ size = 12 }) {
    return (
        <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24"
             fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
    )
}

// Single labeled slider row — used by OverlayPopup (cover-up/logo Size,
// Opacity, Rotate).
export function OverlayRow({ label, value, min, max, step = 1, suffix = '', onChange }) {
    return (
        <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-[9px] font-bold tracking-wider text-editor-ink-muted uppercase">{label}</span>
            <input type="range" min={min} max={max} step={step} value={value}
                   onChange={e => onChange(Number(e.target.value))}
                   onMouseDown={e => e.stopPropagation()}
                   className="flex-1 accent-editor-primary h-1 cursor-pointer"/>
            <span className="w-9 shrink-0 text-right text-[10px] font-mono tabular-nums text-editor-ink">{value}{suffix}</span>
        </div>
    )
}

// Was three copy-pasted identical strips in middle.jsx (publish/overlay/polygon
// errors) — each still has its own independent state/setter at the call site,
// this only shares the render.
export function ErrorBanner({ message, onDismiss }) {
    return (
        <div className="h-8 flex items-center gap-2 px-5 border-b border-red-200 bg-red-50 text-[11px] font-medium text-red-600 shrink-0">
            {message}
            <button onClick={onDismiss} className="ml-auto text-red-400 hover:text-red-600">Dismiss</button>
        </div>
    )
}

const ROT_STEP = (10 * Math.PI) / 180

// onSaveView, savingView, savedView are optional — CameraControls still works
// as plain pan/zoom buttons without them (used in the preview-less contexts).
export function CameraControls({ psvRef, onSaveView, savingView, savedView }) {
    const controls = [
        { label: '▲', fn: v => { const p = v.getPosition(); v.rotate({ yaw: p.yaw, pitch: p.pitch + ROT_STEP }) } },
        { label: '▼', fn: v => { const p = v.getPosition(); v.rotate({ yaw: p.yaw, pitch: p.pitch - ROT_STEP }) } },
        { label: '◀', fn: v => { const p = v.getPosition(); v.rotate({ yaw: p.yaw - ROT_STEP, pitch: p.pitch }) } },
        { label: '▶', fn: v => { const p = v.getPosition(); v.rotate({ yaw: p.yaw + ROT_STEP, pitch: p.pitch }) } },
        { label: '+', fn: v => v.zoomIn(10)  },
        { label: '−', fn: v => v.zoomOut(10) },
    ]
    return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {controls.map((c, i) => (
                <button key={i} onClick={() => psvRef.current && c.fn(psvRef.current)}
                        className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur text-editor-ink text-[13px] font-bold hover:bg-white shadow-sm border border-editor-border transition-colors">
                    {c.label}
                </button>
            ))}
            {onSaveView && (
                <button onClick={onSaveView} disabled={savingView}
                        title="Save the current pan/zoom as this scene's opening view"
                        className="h-8 px-3 rounded-lg bg-white/90 backdrop-blur text-editor-ink text-editor-sm font-semibold hover:bg-white shadow-sm border border-editor-border disabled:opacity-50 transition-colors flex items-center gap-1.5">
                    {savingView
                        ? <><Spinner size={11}/>Saving…</>
                        : savedView
                            ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>Saved</>
                            : 'Set as opening view'}
                </button>
            )}
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
            <div className="bg-white rounded-2xl border border-editor-border shadow-2xl p-6 w-[360px] space-y-4">
                <p className="text-editor-lg font-semibold text-editor-ink">Project settings</p>

                <div className="space-y-1">
                    <label className="text-editor-sm text-editor-ink-muted uppercase tracking-wider">Auto-rotate speed</label>
                    <input type="number" step="0.5" value={draft.auto_rotate}
                           onChange={e => onChange({ ...draft, auto_rotate: parseFloat(e.target.value) || 0 })}
                           className="w-full h-8 border border-editor-border rounded-lg px-2.5 text-editor-base focus:outline-none focus:border-editor-primary"/>
                    <p className="text-editor-xs text-editor-ink-muted">Degrees/sec. Negative = clockwise. 0 = off.</p>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={draft.show_intro}
                           onChange={e => onChange({ ...draft, show_intro: e.target.checked })}
                           className="w-4 h-4 accent-editor-primary"/>
                    <span className="text-editor-base text-editor-ink">Show "tap to move" intro tip on first load</span>
                </label>
                {/* Master switch for the plot-number badges — the per-zone
                    checkbox in the zone form stays as the per-plot exception.
                    Labels also hide themselves when a plot gets too small on
                    screen to hold one, which needs no setting. */}
                <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={draft.show_zone_labels !== false}
                           onChange={e => onChange({ ...draft, show_zone_labels: e.target.checked })}
                           className="w-4 h-4 accent-editor-primary"/>
                    <span className="text-editor-base text-editor-ink">Show zone labels on the map</span>
                </label>
                <div className="flex gap-2 pt-1">
                    <button onClick={onClose} disabled={saving}
                            className="flex-1 h-9 text-editor-base rounded-xl border border-editor-border text-editor-ink-muted hover:bg-editor-subtle transition-colors disabled:opacity-40">
                        Cancel
                    </button>
                    <button onClick={onSave} disabled={saving}
                            className="flex-1 h-9 text-editor-base rounded-xl bg-editor-primary text-white font-semibold hover:bg-editor-primary-hover disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
                        {saving ? <><Spinner/>Saving…</> : 'Save settings'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// Shared shell for both delete confirmations below — they were previously two
// near-identical components (DeleteModal / HotspotDeleteModal) differing only
// in copy and which handler/flag they're wired to.
export function ConfirmDeleteModal({ title, description, confirmLabel = 'Delete', onConfirm, onClose, deleting }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl border border-editor-border shadow-2xl p-6 w-[320px]">
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
                        <p className="text-editor-lg font-semibold text-editor-ink">{title}</p>
                        <p className="text-editor-sm text-editor-ink-muted mt-0.5">{description}</p>
                    </div>
                </div>
                <div className="flex gap-2 mt-4">
                    <button onClick={onClose} disabled={deleting}
                            className="flex-1 h-9 text-editor-base rounded-xl border border-editor-border text-editor-ink-muted hover:bg-editor-subtle transition-colors disabled:opacity-40">
                        Cancel
                    </button>
                    <button onClick={onConfirm} disabled={deleting}
                            className="flex-1 h-9 text-editor-base rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                        {deleting ? <><Spinner/>Deleting…</> : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}

// Lets a client grab a ready-to-paste <iframe> snippet from inside the app
// itself, rather than that snippet only ever existing as something silently
// dropped on the clipboard — the height is adjustable here (the one thing
// worth tweaking per site) and the snippet updates live as it changes, with
// a real live preview underneath so it's obvious this is exactly the
// published tour, not a separate embed-only variant of it.
export function EmbedModal({ url, onClose }) {
    const [height, setHeight] = useState(600)
    const [copied, setCopied] = useState(false)

    // allow="fullscreen" (+ the older allowfullscreen attribute) is what lets
    // the tour's own fullscreen button work once embedded — without it the
    // browser silently blocks requestFullscreen() inside a cross-origin
    // iframe, same as any other site's embedded video/map.
    const snippet = `<iframe src="${url}" width="100%" height="${height}" style="border:0" allow="fullscreen" allowfullscreen loading="lazy"></iframe>`

    async function copySnippet() {
        try { await navigator.clipboard.writeText(snippet) }
        catch {
            const ta = Object.assign(document.createElement('textarea'), { value: snippet })
            document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove()
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl border border-editor-border shadow-2xl p-6 w-full max-w-[560px] max-h-[90vh] overflow-y-auto space-y-4">
                <div className="flex items-center justify-between">
                    <p className="text-editor-lg font-semibold text-editor-ink">Embed this tour</p>
                    <button onClick={onClose} className="text-editor-ink-dim hover:text-editor-ink transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                </div>
                <p className="text-editor-sm text-editor-ink-muted -mt-2">
                    Paste this into any page on the client's own site — it renders the exact same live tour as the published link.
                </p>

                <div className="flex items-center gap-2.5">
                    <label className="text-editor-sm text-editor-ink-muted shrink-0">Height</label>
                    <input type="number" min="200" step="10" value={height}
                           onChange={e => setHeight(Math.max(200, Number(e.target.value) || 600))}
                           className="w-24 h-8 border border-editor-border rounded-lg px-2.5 text-editor-base focus:outline-none focus:border-editor-primary"/>
                    <span className="text-editor-xs text-editor-ink-muted">px — width always fills its container</span>
                </div>

                <textarea readOnly value={snippet} rows={3} onFocus={e => e.target.select()}
                          className="w-full font-mono text-[11px] leading-relaxed border border-editor-border rounded-lg p-3 bg-editor-subtle text-editor-ink resize-none focus:outline-none focus:border-editor-primary"/>

                <div className="rounded-xl overflow-hidden border border-editor-border bg-editor-subtle">
                    <iframe src={url} style={{ width: '100%', height: 260, border: 0, display: 'block' }} allow="fullscreen" allowFullScreen loading="lazy"/>
                </div>

                <div className="flex gap-2 pt-1">
                    <button onClick={onClose}
                            className="flex-1 h-9 text-editor-base rounded-xl border border-editor-border text-editor-ink-muted hover:bg-editor-subtle transition-colors">
                        Close
                    </button>
                    <button onClick={copySnippet}
                            className="flex-1 h-9 text-editor-base rounded-xl bg-editor-primary text-white font-semibold hover:bg-editor-primary-hover transition-colors flex items-center justify-center gap-1.5">
                        {copied
                            ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
                            : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy code</>}
                    </button>
                </div>
            </div>
        </div>
    )
}