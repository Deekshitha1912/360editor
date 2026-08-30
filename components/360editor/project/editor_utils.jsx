// components/360editor/project/editor_utils.js
// Pure helpers shared by the editor — no React, no side effects.
//
// The hand-rolled spherical projection math that used to live here
// (screenToPitchYaw / pitchYawToScreen) is gone — it only ever existed because
// Pannellum didn't expose that conversion publicly. Photo Sphere Viewer does,
// via viewer.dataHelper.viewerCoordsToSphericalCoords() / .sphericalCoordsToViewerCoords()
// (radians), called directly at the two call sites in middle.jsx that need them.

export function roundTo2(n) { return parseFloat(n.toFixed(2)) }
export function clampPct(n) { return Math.min(100, Math.max(0, n)) }

// ─── Flags reducer (publish/export/save/delete busy states) ──────────────────
export const flagsInit = { exporting: false, publishing: false, unpublishing: false, savingSettings: false, deleting: false, savingHotspot: false }
export function flagsReducer(state, action) { return { ...state, [action]: !state[action] } }