'use client'
// components/360editor/project/preview.jsx
// Full-screen preview modal — renders the exact same HTML the export produces,
// but inside an iframe so the user can test navigation before downloading.
import { useEffect, useState } from 'react'

export default function TourPreviewModal({ html, projectName, onClose }) {
    // The blob URL is created in an effect keyed on `html`, NOT inline in the
    // render body. Creating it inline meant a fresh URL — and a fresh
    // iframe.src — on every re-render of this component for ANY reason, which
    // reloads the whole tour (back to scene 1, intro popup and all) even
    // though nothing about the tour itself changed. Fullscreen's resize event
    // was triggering exactly that: an unrelated re-render, mistaken for "the
    // preview needs to reload".
    const [src, setSrc] = useState(null)

    useEffect(() => {
        if (!html) { setSrc(null); return }
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
        const url  = URL.createObjectURL(blob)
        setSrc(url)
        return () => URL.revokeObjectURL(url)
    }, [html])

    if (!html || !src) return null

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-black">

            {/* ── Top bar ── */}
            <div className="h-10 flex items-center px-4 gap-3 bg-[#0f0f0e] border-b border-white/10 shrink-0">
                {/* Globe icon */}
                <div className="w-5 h-5 bg-editor-primary rounded flex items-center justify-center shrink-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                </div>

                <span className="text-[12px] font-semibold text-white/80 flex-1 truncate">
                    Preview — {projectName}
                </span>

                {/* "Preview only" badge */}
                <span className="text-[10px] font-medium text-white/40 bg-white/8 px-2 py-0.5 rounded-full border border-white/10">
                    Preview only · not saved
                </span>

                {/* Close */}
                <button
                    onClick={onClose}
                    className="flex items-center justify-center w-7 h-7 rounded-lg text-white/50
                               hover:text-white hover:bg-white/10 transition-colors shrink-0"
                    title="Close preview"
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            {/* ── iframe ──
                Fullscreen from inside an iframe needs explicit opt-in from the
                PARENT frame — allow="fullscreen" is the modern Permissions
                Policy form, allowFullScreen is the legacy boolean some browsers
                still key off. Both, to be safe. */}
            <iframe
                src={src}
                className="flex-1 w-full border-0"
                title={`Preview — ${projectName}`}
                allow="fullscreen"
                allowFullScreen
            />
        </div>
    )
}
