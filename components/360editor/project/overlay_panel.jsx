'use client'
// components/360editor/project/overlay_panel.jsx
//
// A LIST, not an editor. Each overlay is one info row — thumbnail, type, which
// scenes it shows in, and a remove button. Clicking a row selects that overlay
// AND opens its edit dialog on the overlay itself in the viewer (same dialog you
// get by clicking it in the middle). All adjustment — size, opacity, rotation,
// scope — happens there, on the thing, not over here. This panel just tells you
// what exists and lets you jump to any of it.
//
//   LOGO      screen-anchored (x, y). Fixed on screen, every view.
//   COVER-UP  panorama-anchored (pitch, yaw). Stuck to the photo, scales w/ zoom.
import { useRef, useState } from 'react'

function Row({ item, kind, selected, offScene, activeSceneId, onSelect, onDelete }) {
    const everyScene = item.scene_id == null
    const scope = everyScene ? 'Every scene' : (item.scene_id === activeSceneId ? 'This scene' : 'Another scene')
    return (
        <div
            onClick={() => onSelect(item.id)}
            className={`group flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                selected ? 'border-[#3730a3] bg-[#3730a3]/[0.04]' : 'border-[#E2E2DA] bg-white hover:border-[#3730a3]/40'
            } ${offScene && !selected ? 'opacity-60' : ''}`}
        >
            <div className="w-10 h-10 rounded-lg border border-[#E2E2DA] shrink-0 overflow-hidden flex items-center justify-center"
                 style={{ backgroundImage: 'linear-gradient(45deg,#eee 25%,transparent 25%,transparent 75%,#eee 75%),linear-gradient(45deg,#eee 25%,transparent 25%,transparent 75%,#eee 75%)', backgroundSize: '10px 10px', backgroundPosition: '0 0,5px 5px' }}>
                <img src={item.url} alt="" className="max-w-full max-h-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-[#1a1a18] leading-tight">
                    {kind === 'logo' ? 'Logo' : 'Cover-up'}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[#9a9a8e] leading-tight mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${everyScene ? 'bg-emerald-400' : 'bg-[#3730a3]'}`}/>
                    {scope}
                </div>
            </div>
            {/* Affordance: a row opens the editor on the overlay */}
            <svg className="opacity-0 group-hover:opacity-100 transition-opacity text-[#c4c4b8] shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            <button
                onClick={e => { e.stopPropagation(); onDelete(item.id) }}
                title="Remove"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#c4c4b8] hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
        </div>
    )
}

function AddTile({ label, busy, disabled, hint, onClick }) {
    return (
        <>
            <button
                onClick={onClick}
                disabled={busy || disabled}
                className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-[#d8d8ce] rounded-xl py-2.5 text-[11px] font-semibold text-[#9a9a8e] hover:border-[#3730a3]/50 hover:text-[#3730a3] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#d8d8ce] disabled:hover:text-[#9a9a8e] transition-colors"
            >
                {busy ? 'Uploading…' : (
                    <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                        {label}
                    </>
                )}
            </button>
            {hint && !busy && <p className="mt-1 text-[9.5px] text-[#9a9a8e] text-center leading-snug">{hint}</p>}
        </>
    )
}

export default function OverlayPanel({
                                         logos, coverups, selectedId,
                                         activeSceneId, hasActiveScene,
                                         onSelect, onAddLogo, onAddCoverup, onDeleteLogo, onDeleteCoverup,
                                         dirty, saving, saved, onSave,
                                     }) {
    const logoInputRef    = useRef(null)
    const coverupInputRef = useRef(null)
    const [busy, setBusy] = useState('')
    const [error, setError] = useState('')

    async function pick(kind, file) {
        if (!file) return
        setError('')
        setBusy(kind)
        try {
            const err = kind === 'logo' ? await onAddLogo(file) : await onAddCoverup(file)
            if (err) setError(err)
        } finally {
            setBusy('')
        }
    }

    const off = item => item.scene_id != null && item.scene_id !== activeSceneId

    return (
        <div className="flex flex-col h-full bg-[#FAFAF7] border-l border-[#E2E2DA] overflow-hidden">

            <div className="px-3 pt-3 pb-1.5 shrink-0">
                <div className="text-[10px] font-bold tracking-widest text-[#9a9a8e] uppercase">Overlays</div>
                <p className="text-[10px] text-[#9a9a8e] mt-0.5">Click one to edit it on the tour.</p>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-4">

                <section>
                    <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-[11px] font-bold text-[#1a1a18]">Logos</span>
                        <span className="text-[9.5px] text-[#9a9a8e]">fixed on screen</span>
                    </div>
                    <div className="space-y-2">
                        {logos.map(l => (
                            <Row key={l.id} item={l} kind="logo"
                                 selected={l.id === selectedId} offScene={off(l)}
                                 activeSceneId={activeSceneId}
                                 onSelect={onSelect} onDelete={onDeleteLogo}/>
                        ))}
                    </div>
                    <div className="mt-2">
                        <AddTile
                            label="Add logo"
                            busy={busy === 'logo'}
                            disabled={logos.length >= 10}
                            hint={logos.length ? undefined : 'A watermark that sits in a corner of every view.'}
                            onClick={() => logoInputRef.current?.click()}
                        />
                    </div>
                    <input ref={logoInputRef} type="file" accept="image/*" hidden
                           onChange={e => { pick('logo', e.target.files?.[0]); e.target.value = '' }}/>
                </section>

                <section className="pt-3 border-t border-[#E2E2DA]">
                    <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-[11px] font-bold text-[#1a1a18]">Cover-ups</span>
                        <span className="text-[9.5px] text-[#9a9a8e]">stuck to the photo</span>
                    </div>
                    <div className="space-y-2">
                        {coverups.map(c => (
                            <Row key={c.id} item={c} kind="coverup"
                                 selected={c.id === selectedId} offScene={off(c)}
                                 activeSceneId={activeSceneId}
                                 onSelect={onSelect} onDelete={onDeleteCoverup}/>
                        ))}
                    </div>
                    <div className="mt-2">
                        <AddTile
                            label="Add cover-up"
                            busy={busy === 'coverup'}
                            disabled={!hasActiveScene || coverups.length >= 20}
                            hint={!hasActiveScene ? 'Open a scene first.' : (coverups.length ? undefined : 'Hide the tripod, a sign, a face.')}
                            onClick={() => coverupInputRef.current?.click()}
                        />
                    </div>
                    <input ref={coverupInputRef} type="file" accept="image/*" hidden
                           onChange={e => { pick('coverup', e.target.files?.[0]); e.target.value = '' }}/>
                </section>

                {error && <p className="text-[10px] text-red-600 leading-snug">{error}</p>}
            </div>

            <div className="shrink-0 border-t border-[#E2E2DA] bg-white px-3 py-2.5">
                <button
                    onClick={onSave}
                    disabled={!dirty || saving}
                    className={`w-full h-9 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                        dirty && !saving
                            ? 'bg-[#3730a3] text-white hover:bg-[#312e81]'
                            : 'bg-[#F4F4EF] text-[#9a9a8e] cursor-not-allowed'
                    }`}
                >
                    {saving
                        ? 'Saving…'
                        : saved
                            ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>Saved</>
                            : dirty ? 'Save overlays' : 'No changes'}
                </button>
                {dirty && !saving && (
                    <p className="mt-1.5 text-[9.5px] text-[#9a9a8e] text-center leading-snug">
                        Unsaved changes won&apos;t show in Preview or on the live link.
                    </p>
                )}
            </div>
        </div>
    )
}