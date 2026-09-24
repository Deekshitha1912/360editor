'use client'
// components/360editor/project/color_picker_row.jsx
//
// Shared color picker: a preset palette (CUSTOM_STATUS_COLORS, the same set
// zones offer for fill/border/hover — includes black/white) plus a native
// <input type="color"> wheel for anything outside those presets. Used by
// polygon_panel.jsx (zone fill/border/hover) and hotspot_panel.jsx (text
// hotspot color) so every color picker in the app is the same control.
//
// Same value/onChange contract as the palette swatches, so picking a custom
// hue and re-picking a preset both just call onPick with a '#rrggbb' string.
// defaultLabel/defaultColor render an extra leading swatch for "no override"
// (title + the color it currently resolves to); omit them for a picker that
// always has SOME concrete value (nothing to fall back to).
import { CUSTOM_STATUS_COLORS } from '@/lib/polygons'

export default function ColorPickerRow({ value, onPick, defaultLabel, defaultColor, onClearDefault }) {
    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            {defaultLabel && (
                <button type="button" onClick={onClearDefault} title={defaultLabel}
                        className={`w-5 h-5 rounded-full shrink-0 border border-editor-border transition-transform ${
                            !value ? 'ring-2 ring-offset-1 ring-editor-primary scale-110' : ''
                        }`}
                        style={{ background: defaultColor }}/>
            )}
            {CUSTOM_STATUS_COLORS.map(c => (
                <button key={c} type="button" onClick={() => onPick(c)} title={c}
                        className={`w-5 h-5 rounded-full shrink-0 border border-editor-border/40 transition-transform ${
                            value === c ? 'ring-2 ring-offset-1 ring-editor-primary scale-110' : ''
                        }`}
                        style={{ background: c }}/>
            ))}
            {/* Native color wheel — covers anything outside the preset
                palette. Its own swatch ring lights up when the current
                value isn't one of the presets above (a custom pick), so
                there's always exactly one lit swatch. */}
            <label title="Custom color…"
                   className={`relative w-5 h-5 rounded-full shrink-0 cursor-pointer overflow-hidden border border-editor-border/40 transition-transform ${
                       value && !CUSTOM_STATUS_COLORS.includes(value) ? 'ring-2 ring-offset-1 ring-editor-primary scale-110' : ''
                   }`}
                   style={{ background: value && !CUSTOM_STATUS_COLORS.includes(value)
                       ? value
                       : 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }}>
                <input type="color" value={value || '#6366f1'} onChange={e => onPick(e.target.value)}
                       className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
            </label>
        </div>
    )
}
