// components/360editor/project/editor_utils.js
// Pure helpers shared by the editor — no React, no side effects.

// ─── Pannellum projection math ────────────────────────────────────────────────
export const DEG = Math.PI / 180

export function screenToPitchYaw(sx, sy, viewPitch, viewYaw, hfov, W, H) {
    const vp    = -viewPitch * DEG
    const f     = (W / 2) / Math.tan(hfov * DEG / 2)
    const u     = (sx - W / 2) / f
    const v     = (H / 2 - sy) / f
    const cosVP = Math.cos(vp), sinVP = Math.sin(vp)
    const y0    = -cosVP - v * sinVP
    const z0    = -sinVP + v * cosVP
    const pitch = Math.atan2(z0, Math.sqrt(u * u + y0 * y0)) / DEG
    let   yaw   = Math.atan2(u, -y0) / DEG + viewYaw
    yaw = ((yaw + 180) % 360 + 360) % 360 - 180
    return { pitch, yaw }
}

export function pitchYawToScreen(pitch, yaw, viewPitch, viewYaw, hfov, W, H) {
    const p     = pitch * DEG
    const dy    = (yaw - viewYaw) * DEG
    const vp    = -viewPitch * DEG
    const cosP  = Math.cos(p)
    const cosVP = Math.cos(vp), sinVP = Math.sin(vp)
    const x0    = cosP * Math.sin(dy)
    const y0    = -cosP * Math.cos(dy)
    const z0    = Math.sin(p)
    const y1    = y0 * cosVP + z0 * sinVP
    const z1    = -y0 * sinVP + z0 * cosVP
    if (y1 >= 0) return null
    const f  = (W / 2) / Math.tan(hfov * DEG / 2)
    const sx = W / 2 + f * (x0 / (-y1))
    const sy = H / 2 - f * (z1 / (-y1))
    if (sx < -W || sx > 2 * W || sy < -H || sy > 2 * H) return null
    return { x: sx, y: sy }
}

export function roundTo2(n) { return parseFloat(n.toFixed(2)) }
export function clampPct(n) { return Math.min(100, Math.max(0, n)) }

// ─── Flags reducer (export/save/delete busy states) ───────────────────────────
export const flagsInit = { exporting: false, savingSettings: false, deleting: false, savingHotspot: false }
export function flagsReducer(state, action) { return { ...state, [action]: !state[action] } }

// ─── Pannellum overrides injected into the viewer ─────────────────────────────
export const PANNELLUM_STYLES = `
.pnlm-hotspot-base { cursor: pointer !important; background: none !important; border: none !important; }
.pnlm-context-menu, .pnlm-load-box, .pnlm-about-msg { display: none !important; }
`