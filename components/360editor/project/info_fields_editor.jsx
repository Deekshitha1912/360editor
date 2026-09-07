'use client'
// components/360editor/project/info_fields_editor.jsx
//
// The "On click: Show info card" content editor — shared by hotspot_panel.jsx
// and polygon_panel.jsx (zones carry the exact same action system, see
// polygon_panel.jsx's own comment on that). A card used to be one fixed
// body-text + one image + one "learn more" link; it's now a user-built list
// of fields instead, each one a text block, an image, or a link, added one
// at a time via "+ New field" and shown in whatever order they were added —
// info_fields on the row, normalized server-side (lib/actions.js).

import { useState } from 'react'

function Spinner({ size = 10 }) {
    return (
        <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24"
             fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
    )
}

const FIELD_TYPES = [
    { type: 'text', label: 'Text', icon: <path d="M4 6h16M4 12h16M4 18h10"/> },
    { type: 'image', label: 'Image', icon: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></> },
    { type: 'link', label: 'Link', icon: <path d="M10 13a5 5 0 0 0 7.54.54l2-2a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 11a5 5 0 0 0-7.54-.54l-2 2a5 5 0 0 0 7.07 7.07l1.5-1.5"/> },
]

function FieldIcon({ type }) {
    const f = FIELD_TYPES.find(f => f.type === type) || FIELD_TYPES[0]
    return (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0 text-editor-ink-dim">
            {f.icon}
        </svg>
    )
}

function FieldRow({ field, onChange, onRemove, onUploadImage }) {
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState('')

    return (
        <div className="rounded-lg border border-editor-border bg-editor-surface p-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
                <FieldIcon type={field.type}/>
                <input
                    value={field.label}
                    onChange={e => onChange({ ...field, label: e.target.value })}
                    placeholder={field.type === 'link' ? 'Link text' : field.type === 'image' ? 'Caption (optional)' : 'Field name'}
                    className="flex-1 min-w-0 h-6 bg-transparent text-[11px] font-semibold text-editor-ink
                               focus:outline-none placeholder:text-editor-ink-dim placeholder:font-normal"
                />
                <button type="button" onClick={onRemove} aria-label="Remove field"
                        className="w-5 h-5 flex items-center justify-center rounded text-editor-ink-dim hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>

            {field.type === 'text' && (
                <textarea
                    value={field.value}
                    onChange={e => onChange({ ...field, value: e.target.value })}
                    rows={2}
                    placeholder="Value"
                    className="w-full bg-editor-panel border border-editor-border rounded-md px-2 py-1
                               text-[11px] text-editor-ink focus:outline-none focus:border-editor-primary
                               placeholder:text-editor-ink-dim resize-none"
                />
            )}

            {field.type === 'link' && (
                <input
                    value={field.value}
                    onChange={e => onChange({ ...field, value: e.target.value })}
                    placeholder="https:// or mailto: or tel:"
                    className="w-full h-6 bg-editor-panel border border-editor-border rounded-md px-2
                               text-[11px] text-editor-ink focus:outline-none focus:border-editor-primary
                               placeholder:text-editor-ink-dim"
                />
            )}

            {field.type === 'image' && (
                field.value ? (
                    <div className="flex items-center gap-1.5">
                        <img src={field.value} alt="" className="w-7 h-7 rounded object-cover border border-editor-border shrink-0"/>
                        <button type="button" onClick={() => onChange({ ...field, value: '' })}
                                className="flex-1 h-6 text-[10.5px] rounded-md border border-editor-border
                                           text-editor-ink-muted hover:bg-editor-subtle transition-colors">
                            Remove
                        </button>
                    </div>
                ) : (
                    <label className="flex items-center justify-center h-6 text-[10.5px] rounded-md border border-dashed
                                       border-editor-border text-editor-ink-muted hover:bg-editor-subtle
                                       transition-colors cursor-pointer">
                        {uploading ? <><Spinner/>&nbsp;Uploading…</> : 'Upload image'}
                        <input
                            type="file" accept="image/*" className="hidden" disabled={uploading}
                            onChange={async e => {
                                const file = e.target.files?.[0]
                                e.target.value = ''
                                if (!file || !onUploadImage) return
                                setUploading(true)
                                setUploadError('')
                                try {
                                    const url = await onUploadImage(file)
                                    if (url) onChange({ ...field, value: url })
                                } catch (err) {
                                    setUploadError(err?.message || 'Upload failed.')
                                } finally {
                                    setUploading(false)
                                }
                            }}
                        />
                    </label>
                )
            )}
            {uploadError && <p className="text-[10px] text-red-500">{uploadError}</p>}
        </div>
    )
}

export default function InfoFieldsEditor({ fields, onChange, onUploadImage }) {
    const list = fields || []
    const [menuOpen, setMenuOpen] = useState(false)

    function addField(type) {
        onChange([...list, { type, label: '', value: '' }])
        setMenuOpen(false)
    }
    function updateAt(i, next) { onChange(list.map((f, j) => j === i ? next : f)) }
    function removeAt(i) { onChange(list.filter((_, j) => j !== i)) }

    return (
        <div className="space-y-1.5">
            <label className="text-[10px] text-editor-ink-muted uppercase tracking-wider font-medium">Card contents</label>

            {list.length === 0 && (
                <p className="text-[10.5px] text-editor-ink-dim leading-relaxed">
                    No fields yet — add text, an image, or a link.
                </p>
            )}

            {list.length > 0 && (
                <div className="space-y-1.5">
                    {list.map((f, i) => (
                        <FieldRow key={i} field={f} onChange={next => updateAt(i, next)} onRemove={() => removeAt(i)} onUploadImage={onUploadImage}/>
                    ))}
                </div>
            )}

            <div className="relative">
                <button type="button" onClick={() => setMenuOpen(o => !o)}
                        className="w-full h-7 text-[11px] font-semibold rounded-lg border border-dashed border-editor-border
                                   text-editor-primary hover:bg-editor-primary/5 hover:border-editor-primary/40
                                   transition-colors flex items-center justify-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
                    New field
                </button>
                {menuOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)}/>
                        <div className="absolute left-0 right-0 mt-1 z-20 bg-editor-panel border border-editor-border
                                         rounded-lg shadow-lg overflow-hidden">
                            {FIELD_TYPES.map(opt => (
                                <button key={opt.type} type="button" onClick={() => addField(opt.type)}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-editor-ink
                                                   hover:bg-editor-primary/8 transition-colors">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-editor-ink-muted">
                                        {opt.icon}
                                    </svg>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
