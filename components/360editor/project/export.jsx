// components/360editor/project/export_builder.js
// Builds the complete standalone tour HTML string.
// Used by the editor for both Preview (iframe) and Export (download).
// Pure JS — no React, no side effects.

import { ARROWS } from '@/lib/arrows'
import { projectLogos, projectCoverups, overlaysForScene } from '@/lib/overlays'
import { colorForStatus, borderColorFor, hoverColorFor, badgeLabelStyleFor, STATUS_COLORS } from '@/lib/polygons'
import { DEFAULT_HOTSPOT_COLOR, DEFAULT_LABEL_COLOR } from '@/lib/hotspots'

const PSV_VERSION = '5.15.1'
const THREE_VERSION = '0.185.1'

// Fallback opening horizontal FOV — must match middle.jsx's DEFAULT_HFOV so a
// published tour's opening view matches what the editor showed. Lower = more
// zoomed in; 70deg reads as a closer, more immersive opening view than the
// old 90deg default without going so narrow it hides the room's edges.
const DEFAULT_HFOV = 62

export function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// JSON embedded verbatim into an inline <script> is a stored-XSS vector if a
// scene name, hotspot label, etc. ever contains "</script>" -- the string would
// close the tag early and let the rest execute as raw HTML. Escaping < and >
// keeps the JSON valid while making that impossible; U+2028/U+2029 (line and
// paragraph separator) are escaped too since they're valid in JSON strings but
// count as real line terminators in JS, which can break a script that isn't
// expecting one mid-string.
function safeJson(value) {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
}

// Plot size for the tour's Minimum size filter and hover tooltip, read from
// the zone's Details: the first key that names a size or area with a number
// in its value. Text with its own unit is shown as typed.
function plotSize(detail) {
    for (const [k, raw] of Object.entries(detail || {})) {
        if (!/size|area|sq\.?\s*ft|sqft/i.test(k)) continue
        const v = String(raw ?? '').trim()
        const m = v.replace(/,/g, '').match(/\d+(\.\d+)?/)
        if (!m) continue
        const n = Number(m[0])
        return { n, text: /[a-z]/i.test(v) ? v : n.toLocaleString('en-IN') + ' sq.ft' }
    }
    return null
}

// Route links are opened from a button: only web links pass, and a pasted
// "maps.app.goo.gl/x" without a scheme still works.
function webUrl(v) {
    const s = String(v || '').trim()
    if (!s) return ''
    if (/^https?:\/\//i.test(s)) return s
    return /^[a-z][a-z0-9+.-]*:/i.test(s) ? '' : 'https://' + s
}

export function buildTourHtml({ project, scenes, hotspots, polygons }) {
    const zones = polygons ?? []
    const autoRotate = project.auto_rotate ?? -3
    const showIntro  = project.show_intro  ?? true

    // Screen-anchored watermarks. projectLogos() also understands the old
    // single logo_url/logo_x/logo_y/logo_size shape, so snapshots published
    // before overlays existed still render correctly.
    // Both lists carry scene_id: null = every scene, else one scene only.
    const allLogos    = projectLogos(project)
    const allCoverups = projectCoverups(project)

    const tours = {}
    const sceneList = []

    for (const scene of scenes) {
        // Sorted by z_index ASCENDING here, once, server-side -- PSV paints
        // markers in plain array order, so this is what lets one hotspot
        // (e.g. a text decal) sit behind or in front of another overlapping
        // one. Mirrors middle.jsx's own arrowMarkers sort.
        const arrows = hotspots
            .filter(h => h.scene_id === scene.id)
            .sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0))
            .map(h => {
                const arrow = ARROWS.find(a => a.type === h.arrow_type) || ARROWS[0]
                return {
                    id: h.id, yaw: h.yaw, pitch: h.pitch,
                    // landmark carries through so arrowMarker() below can
                    // build an 'html' marker instead of an 'image' one —
                    // gif still gets set (harmlessly unused for landmark)
                    // so this stays a valid entry for v1-snapshot compat.
                    type: h.arrow_type,
                    gif: arrow.gif, label: h.label || '',
                    // 'custom' is a plain billboard exactly like every other
                    // type here -- the ONLY difference is which image it
                    // renders, so it needs no marker-builder branch of its
                    // own, just this one field arrowMarker's fallback branch
                    // prefers over `gif` when set.
                    customIconUrl: h.custom_icon_url || '',
                    size: h.size ?? project.hotspot_size ?? 90,
                    rotation: h.rotation ?? 0,
                    color: h.color || DEFAULT_HOTSPOT_COLOR,
                    labelColor: h.label_color || DEFAULT_LABEL_COLOR,
                    rotateX: h.rotate_x ?? 90,
                    rotateY: h.rotate_y ?? 0,
                    target: h.target_scene_id,
                    actionType: h.action_type || 'navigate',
                    linkUrl: h.link_url || '',
                    infoBody: h.info_body || '',
                    infoImageUrl: h.info_image_url || '',
                    infoFields: Array.isArray(h.info_fields) ? h.info_fields : [],
                    toggleTargetId: h.toggle_target_id || '',
                    startHidden: !!h.start_hidden,
                    animateLine: h.animate_line !== false,
                    // 'siteplan' only — the parsed DXF geometry (shapes +
                    // bbox) that _planDecalImage renders on the fly. null
                    // for every other type (and for a 'siteplan' hotspot
                    // whose import never actually succeeded).
                    planShapes: h.plan_shapes || null,
                    // Landmark callout pill, e.g. "18 min".
                    sublabel: h.sublabel || '',
                    description: h.description || '',
                    distanceText: h.distance_text || '',
                    routeUrl: webUrl(h.route_url),
                }
            })

        // Cover-ups visible in THIS scene (every-scene + scene-scoped), listed
        // first so arrows stack above them and they take no clicks.
        const covers = overlaysForScene(allCoverups, scene.id).map(c => ({
            id: c.id, yaw: c.yaw, pitch: c.pitch,
            url: c.url, size: c.size, opacity: c.opacity, rotation: c.rotation,
        }))

        // Zones are always scene-scoped (no "every scene" concept). The color
        // is resolved server-side from status here, once, rather than shipping
        // a status->color lookup table to the client.
        // Sorted by z_index ASCENDING here, once, server-side — PSV paints
        // markers in plain array order, so this is what lets a road/common-
        // area strip sit UNDER the plots crossing it. Stable, so zones
        // sharing a z_index keep the order they already had. Mirrors
        // middle.jsx's own orderedPolygons.
        const sceneZones = zones
            .filter(z => z.scene_id === scene.id)
            .sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0))
            .map(z => ({
                id: z.id,
                points: z.points,
                color: colorForStatus(z.status, z.custom_color),
                borderColor: borderColorFor(colorForStatus(z.status, z.custom_color), z.border_color),
                hoverColor: hoverColorFor(colorForStatus(z.status, z.custom_color), z.hover_color),
                fillOpacity: z.fill_opacity ?? 0.33,
                hoverOpacity: z.hover_opacity ?? 0.6,
                status: z.status,
                sizeNum: plotSize(z.detail)?.n ?? null,
                sizeText: plotSize(z.detail)?.text ?? '',
                label: z.label || '',
                // ANDed with the tour-wide switch here, once, rather than
                // shipping both flags and re-checking per frame in the tour.
                showLabel: z.show_label !== false && project.show_zone_labels !== false,
                // Precomputed here, server-side, rather than shipping the
                // color logic to the client's own copy of this file's script
                // — that plain string can import lib/polygons.js, this
                // build step can.
                labelStyle: badgeLabelStyleFor(z.label_color),
                detail: z.detail || {},
                edgeLengths: z.edge_lengths || [],
                actionType: z.action_type || 'info',
                target: z.target_scene_id,
                linkUrl: z.link_url || '',
                infoBody: z.info_body || '',
                infoImageUrl: z.info_image_url || '',
                infoFields: Array.isArray(z.info_fields) ? z.info_fields : [],
                toggleTargetId: z.toggle_target_id || '',
                startHidden: !!z.start_hidden,
            }))

        tours[scene.id] = {
            name:  scene.name,
            panorama: scene.url,
            yaw:   scene.initial_yaw   ?? 0,
            pitch: scene.initial_pitch ?? -5,
            hfov:  scene.initial_hfov  ?? DEFAULT_HFOV,
            // The Top view button's target (set in the editor); null falls
            // back to looking straight down.
            top: scene.top_pitch != null
                ? { yaw: scene.top_yaw ?? 0, pitch: scene.top_pitch, hfov: scene.top_hfov ?? scene.initial_hfov ?? DEFAULT_HFOV }
                : null,
            arrows, covers, zones: sceneZones,
        }
        sceneList.push({ id: scene.id, name: scene.name, url: scene.url })
    }

    const toursJson     = safeJson(tours)
    const statusColorsJson = safeJson(STATUS_COLORS)
    // Project badge + contact buttons. Digits only for WhatsApp (wa.me wants
    // the bare international number).
    const brandJson = safeJson({
        name: project.name || '',
        subtitle: project.location_subtitle || '',
        logo: project.cover_logo_url || '',
        phone: (project.contact_phone || '').trim(),
        whatsapp: (project.whatsapp_number || '').replace(/[^0-9]/g, ''),
        maps: project.maps_url || '',
    })
    const sceneListJson = safeJson(sceneList)

    // Logo watermarks — fixed screen overlays, NOT sphere markers. Because a
    // logo can now be scoped to one scene, the set is rebuilt on every
    // scenechange from data rather than baked once. The layer element is always
    // present (fullscreen moves it); its contents are swapped by _wm() below.
    const logoData = safeJson(allLogos.map(l => ({
        u: l.url, s: l.scene_id, x: l.x, y: l.y, w: l.size, o: l.opacity,
    })))
    const logoHtml = `<div id="wmLayer"></div>`

    // Shown once, above the project name, on the loading screen only — NOT
    // the same thing as `overlays` (screen-anchored watermarks shown WHILE
    // touring, possibly several, each scoped to a scene). Undefined on an
    // older published snapshot (from before this column existed) is just as
    // falsy as null, so this renders nothing for those without any special-
    // casing.
    const coverLogoHtml = project.cover_logo_url
        ? `<img id="loadLogo" src="${escapeHtml(project.cover_logo_url)}" alt="" style="max-width:200px;max-height:100px;object-fit:contain;margin-bottom:18px;display:block;">`
        : ''

    const introHtml = showIntro ? `<div id="introBox" style="display:none;position:fixed;inset:0;z-index:90000;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);font-family:'Poppins',-apple-system,sans-serif;"><div style="background:rgba(10,10,10,.85);border-radius:20px;padding:36px 44px;text-align:center;color:#fff;max-width:360px;"><div style="font-size:44px;margin-bottom:14px;">👆</div><p style="font-size:19px;font-weight:600;margin:0 0 8px">Tap arrows to move</p><p style="font-size:13px;opacity:.65;margin:0 0 24px">Drag anywhere to look around</p><button id="introDismiss" style="background:#3730a3;color:#fff;border:none;border-radius:30px;padding:11px 32px;font-size:15px;font-weight:600;cursor:pointer;">Got it</button></div></div>` : ''

    const introCode = showIntro ? `var _is=false;viewer.addEventListener('ready',function(){if(!_is&&first){document.getElementById('introBox').style.display='flex';_is=true;}},{once:true});document.getElementById('introDismiss').addEventListener('click',function(){document.getElementById('introBox').style.display='none';});` : ''

    // RPM = (deg/sec) / 6 (360deg / 60sec). 0 or missing -> no plugin at all,
    // rather than loading it just to sit idle at speed 0.
    const rpm = autoRotate ? autoRotate / 6 : 0
    const autorotateImport  = rpm ? `import { AutorotatePlugin } from 'https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/autorotate-plugin@${PSV_VERSION}/index.module.min.js';` : ''
    const autorotatePluginEntry = rpm ? `,[AutorotatePlugin,{autorotateSpeed:'${rpm}rpm'}]` : ''

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(project.name)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/core@${PSV_VERSION}/index.min.css"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/markers-plugin@${PSV_VERSION}/index.min.css"/>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;font-family:'Poppins',-apple-system,sans-serif;background:#000}
#viewer{width:100vw;height:100vh}
.wm{position:fixed;transform:translate(-50%,-50%);z-index:15000;pointer-events:none;max-width:90vw;}
.wm img{display:block;width:100%;height:auto;filter:drop-shadow(0 2px 8px rgba(0,0,0,.5));}
#sceneSidebar{position:fixed;top:50%;left:24px;transform:translateY(-50%);z-index:20000;max-height:62vh;overflow-y:auto;-ms-overflow-style:none;scrollbar-width:none;display:flex;flex-direction:column;gap:8px;padding:8px;background:rgba(250,249,245,.94);border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.25);opacity:1;transition:opacity .28s ease,transform .28s ease;}
#sceneSidebar::-webkit-scrollbar{display:none}
#sceneSidebar.hidden{opacity:0;transform:translateY(-50%) translateX(-12px);pointer-events:none;}
/* Neutral dark glass -- NOT saturate()'d, which was pulling in whatever warm
   tone the panorama behind it happened to be (that's what read as "orange"). */
/* Fixed to the image's own width so a long scene name never widens the
   item past it -- the name is what gets trimmed (ellipsis), never the
   image's flush position against the right edge. */
.ss-item{cursor:pointer;text-align:center;transition:transform .25s ease;width:78px;}.ss-item:hover{transform:scale(1.06)}
.ss-item img{width:78px;height:49px;object-fit:cover;border-radius:8px;display:block;box-shadow:0 2px 10px rgba(0,0,0,.5);border:2px solid transparent;transition:border-color .2s ease;}
.ss-item.active img{border-color:#3730a3}
.ss-item span{display:block;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px;font-size:10px;color:#fff;font-weight:600;text-shadow:0 1px 4px rgba(0,0,0,.75);}
#loadOverlay{position:fixed;inset:0;background:#0a0a0a;color:#fff;display:flex;justify-content:center;align-items:center;flex-direction:column;z-index:100001;}
#loadTitle{font-size:22px;font-weight:600;margin-bottom:8px;}#loadPct{font-size:13px;opacity:.55;margin-bottom:22px}
#loadBar{width:260px;height:3px;background:rgba(255,255,255,.18);border-radius:2px;overflow:hidden}#loadFill{height:100%;background:#3730a3;width:0%;transition:width .3s ease}
#rotateOverlay{position:fixed;inset:0;background:#0a0a0a;color:#fff;display:none;justify-content:center;align-items:center;flex-direction:column;z-index:100000;text-align:center;padding:24px;}
@keyframes breathe{0%,100%{transform:scale(1);opacity:.75}50%{transform:scale(1.08);opacity:1}}
#rotateOverlay svg{animation:breathe 2.8s ease-in-out infinite;margin-bottom:20px}
#rotateOverlay p{font-size:19px;font-weight:600;line-height:1.5;opacity:.9}
@media(orientation:portrait){#rotateOverlay{display:flex}}
#zoneCardBackdrop{display:none;position:fixed;inset:0;z-index:24999;background:rgba(10,10,14,.55);backdrop-filter:blur(2px);}
/* No fixed width -- a position:fixed block with no width/right set shrinks
   to fit its content, so the card hugs whatever's actually inside it
   (typically just an image at its own natural size) instead of forcing
   that content into a fixed box. That's the fix for the black bars that
   showed above/below an image under object-fit:contain: those were never a
   border, they were the card's own background showing through the gap
   contain leaves when an image's aspect ratio doesn't match a fixed box.
   With no fixed box to not-quite-fill, there's no gap to show through. */
#zoneCard{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:25000;display:none;max-width:calc(100vw - 36px);max-height:calc(100vh - 36px);overflow-y:auto;overflow-x:hidden;background:transparent;padding:0;color:#fff;box-shadow:0 12px 36px rgba(0,0,0,.45);border-radius:14px;}
#zoneCard .zc-close{position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:50%;border:none;background:rgba(20,20,26,.65);color:#fff;font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);box-shadow:0 2px 10px rgba(0,0,0,.35);transition:background .15s ease;z-index:1;}
#zoneCard .zc-close:hover{background:rgba(0,0,0,.8)}
/* Images live directly on the transparent card, never inside the padded/
   dark #zcDetail below -- sized to their own natural dimensions (capped for
   the viewport), so nothing is ever a fixed box an image could fail to
   exactly fill. Rounded corners on every side; #zcDetail's own top corners
   square off against an image directly above it (only #zcDetail:first-child
   gets full rounding, i.e. a card with no image at all). */
#zoneCard #zcImages{max-width:min(480px,calc(100vw - 36px));}
#zoneCard .zc-image{display:block;width:auto;height:auto;max-width:100%;max-height:80vh;margin:0 auto;border-radius:14px;}
#zoneCard .zc-caption{font-size:11px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.8);text-align:center;margin:6px 0 0;}
/* Detail rows/text/links keep a solid readable backing and their own
   padding, separate from any image above -- empty (no Details, no non-image
   Card contents) means display:none, so an image-only card shows nothing
   but the image. */
#zoneCard #zcDetail{background:rgba(20,20,26,.92);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.14);border-radius:0 0 14px 14px;padding:14px;max-width:min(480px,calc(100vw - 36px));}
#zoneCard #zcDetail.zc-solo{border-radius:14px;}
#zoneCard .zc-row{display:flex;justify-content:space-between;gap:10px;font-size:12px;padding:3px 0;}
#zoneCard .zc-row span:first-child{opacity:.55}
#zoneCard .zc-row span:last-child{font-weight:600;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
#zoneCard .zc-body{font-size:12px;line-height:1.5;opacity:.85;margin:8px 0 0;white-space:pre-wrap;}
#zoneCard .zc-link{display:inline-block;margin:8px 6px 0 0;background:#3730a3;color:#fff;font-size:11px;font-weight:600;text-decoration:none;padding:7px 14px;border-radius:16px;text-align:center;}
#zoneCard .zc-field-label{font-size:10px;font-weight:700;opacity:.55;text-transform:uppercase;letter-spacing:.04em;margin:10px 0 3px;}
#imgLightbox{display:none;position:fixed;inset:0;z-index:95000;background:rgba(10,10,14,.55);backdrop-filter:blur(2px);align-items:center;justify-content:center;opacity:0;transition:opacity .25s ease;}
#imgLightbox.show{opacity:1;}
#imgLbFrame{position:relative;max-width:90vw;max-height:88vh;transform:scale(.9);transition:transform .32s cubic-bezier(.22,1,.36,1);}
#imgLightbox.show #imgLbFrame{transform:scale(1);}
#imgLbFrame img{display:block;max-width:90vw;max-height:88vh;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.5);}
#imgLbClose{position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:50%;border:none;background:rgba(20,20,26,.65);color:#fff;font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);box-shadow:0 2px 10px rgba(0,0,0,.35);transition:background .15s ease;}
#imgLbClose:hover{background:rgba(0,0,0,.8)}
.edge-label{position:fixed;transform:translate(-50%,-50%);z-index:15000;pointer-events:none;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);color:#fff;font-size:10px;font-weight:600;padding:3px 8px;border-radius:20px;white-space:nowrap;}
/* Always-visible plot-number badge at a zone's centre. Neutral light pill
   rather than the zone's own color, so one style stays legible on every
   fill. Non-interactive so it never steals the zone's own click. */
.zone-label{pointer-events:none;width:34px;height:34px;border-radius:50%;background:#fff;color:#14141a;border:2.5px solid var(--zc,#22c55e);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;line-height:1;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.35);transition:transform .2s ease;}
.zone-label.zl-long{width:auto;min-width:34px;padding:0 7px;border-radius:17px;font-size:12px;}
/* Mild hover fade for zones. Costs no JavaScript: the markers plugin sets
   fill/stroke with setAttributeNS on an element it REUSES across updates, and
   a presentation attribute participates in the cascade, so changing it
   transitions like any other computed style change. Only the one zone under
   the pointer is ever animating. Properties are listed explicitly and never
   as "all" -- the polygon's points attribute is rewritten every frame as the
   camera moves, and transitioning THAT would smear every zone on each pan. */
.psv-marker--poly{transition:fill .16s ease-out,stroke .16s ease-out,stroke-width .16s ease-out;}
.hs-info{padding:2px 2px 8px}
.hs-info h3{font-size:15px;font-weight:600;margin:0 0 8px}
.hs-info img{display:block;width:100%;border-radius:10px;margin-bottom:10px;object-fit:cover;max-height:180px;}
.hs-info p{font-size:13px;line-height:1.5;opacity:.85;margin:0 0 12px;white-space:pre-wrap;}
.hs-info a{display:inline-block;background:#3730a3;color:#fff;font-size:12px;font-weight:600;text-decoration:none;padding:8px 16px;border-radius:20px;margin:0 8px 8px 0;}
.hs-info .hs-caption{font-size:11px;opacity:.6;margin:-6px 0 10px;}
.hs-info .hs-field-label{font-size:10.5px;font-weight:700;opacity:.55;text-transform:uppercase;letter-spacing:.04em;margin:0 0 3px;}
.lm{position:relative;display:flex;flex-direction:column;align-items:center;pointer-events:auto;filter:drop-shadow(0 4px 10px rgba(0,0,0,.28));}
.lm-label{background:#fff;color:var(--brand,#0b5d3b);font-size:14px;font-weight:600;line-height:1.25;text-align:center;padding:7px 16px 9px;border-radius:5px;border:2px solid var(--lm-color,#f5b800);max-width:240px;white-space:normal;}
.lm-pill{display:inline-block;margin-top:5px;background:var(--lm-color,#f5b800);color:#1a1a18;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;}
.lm-line{width:2.5px;height:var(--lm-height,48px);background:var(--lm-color,#f5b800);}
.lm-dot{width:13px;height:13px;border-radius:50%;background:var(--lm-color,#f5b800);border:2px solid #fff;box-shadow:0 0 0 0 var(--lm-color,#f5b800);animation:lm-pulse 2s ease-out infinite;}
@keyframes lm-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb, var(--lm-color,#3730a3) 55%, transparent)}70%{box-shadow:0 0 0 14px color-mix(in srgb, var(--lm-color,#3730a3) 0%, transparent)}100%{box-shadow:0 0 0 0 color-mix(in srgb, var(--lm-color,#3730a3) 0%, transparent)}}
.lm.lm-anim .lm-line{transform:scaleY(0);transform-origin:bottom center;transition:transform 1.1s cubic-bezier(.22,1,.36,1);}
.lm.lm-anim .lm-label{opacity:0;transition:opacity .3s ease;}
.lm.lm-anim.lm-in-view .lm-line{transform:scaleY(1);}
.lm.lm-anim.lm-in-view .lm-label{opacity:1;transition:opacity .3s ease 1.1s;}
/* ── Tour chrome (badge, top buttons, right rail, legend, plot strip) ── */
:root{--brand:#0b5d3b;--accent:#f5b800;--chip:rgba(250,249,245,.95);}
.chip{background:var(--chip);color:#1a1a18;border:none;border-radius:28px;box-shadow:0 4px 16px rgba(0,0,0,.22);font-family:inherit;}
#brand{position:fixed;top:16px;left:20px;z-index:20000;display:flex;align-items:center;gap:10px;padding:6px 18px 6px 6px;max-width:min(380px,calc(100vw - 40px));}
#brandMark{width:36px;height:36px;border-radius:50%;background:var(--brand);color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;}
#brandMark img{width:100%;height:100%;object-fit:cover;}
#brandName{font-size:15px;font-weight:600;line-height:1.15;color:#1a1a18;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#brandSub{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#6b6b60;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#topbar{position:fixed;top:16px;right:20px;z-index:20000;display:flex;gap:8px;}
.tb{position:relative;display:flex;align-items:center;gap:7px;height:42px;padding:0 16px;font-size:14px;font-weight:500;cursor:pointer;transition:transform .15s ease,background .15s ease;}
.tb:hover{transform:translateY(-1px);background:#fff;}
.tb svg{flex-shrink:0;}
.tb.accent{background:var(--accent);}
.tb.accent:hover{background:#ffc61a;}
.dd{position:absolute;top:50px;right:0;min-width:200px;max-height:60vh;overflow-y:auto;background:#fff;border-radius:12px;box-shadow:0 10px 32px rgba(0,0,0,.25);padding:6px;display:none;cursor:default;}
.dd.open{display:block;}
.dd-item{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:none;background:none;border-radius:8px;font:inherit;font-size:13px;color:#1a1a18;text-align:left;cursor:pointer;}
.dd-item:hover{background:#f3f2ec;}
.dd-item small{margin-left:auto;font-size:11px;color:#6b6b60;}
.dd-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.dd-item input{width:14px;height:14px;accent-color:var(--brand);}
#rail{position:fixed;top:50%;right:20px;transform:translateY(-50%);z-index:20000;display:flex;flex-direction:column;gap:9px;}
.rb{width:46px;height:46px;border-radius:10px;border:none;background:var(--chip);color:#1a1a18;box-shadow:0 4px 16px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .15s ease,background .15s ease;}
.rb:hover{background:#fff;transform:scale(1.04);}
.rb.on{background:var(--brand);color:#fff;}
#legend{position:fixed;left:20px;bottom:88px;z-index:20000;display:flex;align-items:center;gap:14px;padding:8px 16px;font-size:13px;}
#legend span{display:flex;align-items:center;gap:6px;white-space:nowrap;}
#legend i{width:11px;height:11px;border-radius:3px;display:inline-block;}
#legend b{font-weight:600;}
#strip{position:fixed;left:20px;right:20px;bottom:16px;z-index:20000;height:60px;border-radius:14px;display:flex;align-items:center;gap:6px;padding:0 14px;overflow-x:auto;scrollbar-width:thin;}
.pl{flex-shrink:0;min-width:44px;height:42px;padding:0 8px;border:none;border-radius:8px;background:transparent;font:inherit;font-size:15px;font-weight:700;color:#1a1a18;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;transition:background .15s ease,opacity .2s ease;}
.pl:hover,.pl.active{background:#ecebe4;}
.pl i{width:24px;height:3px;border-radius:2px;display:block;}
.pl.dim{opacity:.28;}
.tb.on,.tb.on:hover{background:var(--brand);color:#fff;}
.fp-title,.np-title{font-size:17px;font-weight:600;color:#14241d;}
#ddFilter{position:fixed;top:66px;right:20px;z-index:20002;width:min(340px,calc(100vw - 40px));max-height:calc(100vh - 82px);min-width:0;padding:18px;border-radius:14px;background:#fbfaf6;}
#ddFilter .dd-item{padding:6px 4px;font-size:14px;background:none;}
#ddFilter .dd-item input{accent-color:auto;}
#ddFilter .dd-dot{width:12px;height:12px;border-radius:3px;}
.fp-label{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b6b60;margin:14px 0 6px;}
.fp-slider{width:100%;accent-color:var(--brand);cursor:pointer;}
.fp-ends{display:flex;justify-content:space-between;font-size:12.5px;color:#6b6b60;margin-top:4px;}
.fp-reset{width:100%;height:42px;margin-top:16px;border:none;border-radius:11px;background:#eeede6;color:#1a1a18;font:inherit;font-size:14px;font-weight:600;cursor:pointer;}
.fp-reset:hover{background:#e6e5dd;}
#nearbyPanel{position:fixed;top:66px;right:20px;z-index:20002;width:min(400px,calc(100vw - 40px));max-height:calc(100vh - 82px);overflow-y:auto;background:#fbfaf6;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.3);padding:18px;display:none;}
#nearbyPanel.open{display:block;}
.np-head{display:flex;align-items:center;justify-content:space-between;}
.np-close{width:34px;height:34px;border:none;border-radius:9px;background:#eeede6;color:#1a1a18;font-size:17px;line-height:1;cursor:pointer;}
.np-close:hover{background:#e6e5dd;}
.np-help{font-size:13px;color:#5f5f55;margin:6px 0 13px;}
.np-card{display:flex;gap:12px;border:1px solid #e4e2da;border-radius:12px;padding:12px;margin-bottom:9px;cursor:pointer;transition:background .15s ease;}
.np-card:hover{background:#f3f2ec;}
.np-time{flex-shrink:0;align-self:flex-start;background:#eeede6;color:#1a1a18;font-size:12px;font-weight:600;padding:6px 11px;border-radius:14px;white-space:nowrap;}
.np-main{flex:1;min-width:0;}
.np-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;}
.np-name{font-size:15px;font-weight:600;line-height:1.25;color:var(--brand);}
.np-route{flex-shrink:0;border:none;background:#eeede6;color:var(--brand);font:inherit;font-size:11.5px;font-weight:600;padding:4px 9px;border-radius:12px;cursor:pointer;}
.np-route:hover{background:#e6e5dd;}
.np-desc{font-size:12.5px;line-height:1.45;color:#5f5f55;margin-top:3px;}
.np-meta{font-size:11.5px;color:#7a7a6e;margin-top:6px;}
@media(max-width:900px){.tb .tbt{display:none;}.tb{padding:0 12px;height:38px;}#brandName{font-size:14px;}#brandSub{font-size:10px;}.rb{width:40px;height:40px;}#legend{font-size:12px;gap:10px;bottom:78px;}#strip{height:52px;}}
</style>
</head>
<body>
<div id="loadOverlay">${coverLogoHtml}<div id="loadTitle">${escapeHtml(project.name)}</div><div id="loadPct">Loading… 0%</div><div id="loadBar"><div id="loadFill"></div></div></div>
<div id="rotateOverlay"><svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.4"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 17h.01"/></svg><p>Please rotate your device<br>to landscape mode</p></div>
${introHtml}
<div id="viewer"></div>
${logoHtml}
<div id="zoneCardBackdrop"></div><div id="zoneCard"><button class="zc-close" aria-label="Close" onclick="hideZoneCard()">&#10005;</button><div id="zcImages"></div><div id="zcDetail"></div></div>
<div id="imgLightbox"><div id="imgLbFrame"><img id="imgLbImg" alt=""><button id="imgLbClose" aria-label="Close">&#10005;</button></div></div>
<div id="brand" class="chip"><div id="brandMark"></div><div style="min-width:0"><div id="brandName"></div><div id="brandSub"></div></div></div>
<div id="topbar">
  <div style="position:relative" id="tbFilterW"><button class="tb chip" id="tbFilter" type="button"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/></svg><span class="tbt">Filter</span></button><div class="dd" id="ddFilter"></div></div>
  <div style="position:relative" id="tbNearbyW"><button class="tb chip" id="tbNearby" type="button"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21V4"/><path d="M7 4h9l-2 3 2 3H7"/></svg><span class="tbt">Nearby</span></button></div>
  <div style="position:relative" id="tbEnquiryW"><button class="tb chip accent" id="tbEnquiry" type="button"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span class="tbt">Enquiry</span></button></div>
  <div style="position:relative" id="tbCallW"><button class="tb chip" id="tbCall" type="button"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg><span class="tbt">Call</span></button></div>
  <div style="position:relative" id="tbLocationW"><button class="tb chip" id="tbLocation" type="button"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg><span class="tbt">Location</span></button></div>
</div>
<div id="nearbyPanel"><div class="np-head"><div class="np-title">Nearby landmarks</div><button class="np-close" id="npClose" type="button" aria-label="Close">&times;</button></div><p class="np-help">Tap a place to turn the view towards it.</p><div id="npList"></div></div>
<div id="rail">
  <button class="rb" id="rbIn" type="button" title="Zoom in" aria-label="Zoom in"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg></button>
  <button class="rb" id="rbOut" type="button" title="Zoom out" aria-label="Zoom out"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg></button>
  <button class="rb" id="rbTop" type="button" title="Top view" aria-label="Top view"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M12 3.5v17M3.5 12H12"/></svg></button>
  <button class="rb" id="rbLook" type="button" title="Look around" aria-label="Look around"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg></button>
  <button class="rb" id="rbMotion" type="button" title="Move your phone to look around" aria-label="Motion control"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg></button>
  <button class="rb" id="rbScenes" type="button" title="Scenes" aria-label="Scenes"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg></button>
  <button class="rb" id="rbFs" type="button" title="Fullscreen" aria-label="Fullscreen"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
</div>
<div id="legend" class="chip"></div>
<div id="strip" class="chip"></div>
<div id="sceneSidebar" class="hidden"></div>
<script type="importmap">
{"imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js",
  "@photo-sphere-viewer/core": "https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/core@${PSV_VERSION}/index.module.min.js"
}}
</script>
<script type="module">
import { Viewer } from 'https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/core@${PSV_VERSION}/index.module.min.js';
import { MarkersPlugin } from 'https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/markers-plugin@${PSV_VERSION}/index.module.min.js';
import { GyroscopePlugin } from 'https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/gyroscope-plugin@${PSV_VERSION}/index.module.min.js';
${autorotateImport}

var TOURS=${toursJson};var SM=${sceneListJson};var BRAND=${brandJson};var STATUS_COLORS=${statusColorsJson};

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
// Two-hex-digit alpha suffix for a zone's fill color -- hand-synced copy of
// lib/polygons.js's alphaHex (this file ships as a plain string, so it can't
// import that module -- same convention as FLOOR_SIZE_MULTIPLIER's own copy
// below). The fill and hover opacities it's applied to are both resolved
// server-side into each zone's data, so no boost constant is needed here.
function _alphaHex(o){var a=Math.round(Math.min(1,Math.max(0,o))*255);var h=a.toString(16);return h.length<2?'0'+h:h;}
// Text decal image -- hand-synced copy of lib/arrows.js's
// textDecalSize/textDecalImage (this file ships as a plain string and can't
// import that module -- same convention as FLOOR_SIZE_MULTIPLIER's own copy
// below).
function _escXml(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c];});}
function _textDecalSize(text){var len=Math.max(1,(text||'').length);return {width:24*2+len*30,height:100};}
function _textDecalImage(text,color){
  var sz=_textDecalSize(text);
  var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+sz.width+'" height="'+sz.height+'" viewBox="0 0 '+sz.width+' '+sz.height+'">'
    +'<text x="'+(sz.width/2)+'" y="'+(sz.height/2)+'" text-anchor="middle" dominant-baseline="central" '
    +'font-family="-apple-system,Segoe UI,Arial,sans-serif" font-size="64" font-weight="700" '
    +'fill="'+(color||'#111111')+'">'+_escXml(text||'Text')+'</text></svg>';
  return 'data:image/svg+xml,'+encodeURIComponent(svg);
}
// Site plan decal -- hand-synced copy of lib/arrows.js's
// planDecalSize/planDecalImage (this file ships as a plain string and can't
// import that module -- same convention as _textDecalSize/_textDecalImage
// above). DXF is Y-up, SVG is Y-down, so Y is flipped here (py below).
var _PLAN_MAX_DIM=2048;
function _planDecalSize(bbox){
  var w=Math.max(1e-6,bbox.maxX-bbox.minX);var h=Math.max(1e-6,bbox.maxY-bbox.minY);
  var scale=_PLAN_MAX_DIM/Math.max(w,h);
  return {width:Math.max(1,Math.round(w*scale)),height:Math.max(1,Math.round(h*scale))};
}
// Hand-synced copies of lib/arrows.js's planRenderRotation / planStretch.
function _planRenderRotation(ps,rx,ry,rz){
  if(ps&&ps.flat===false) return {x:rx==null?90:rx,y:ry==null?0:ry,z:rz==null?0:rz};
  var heading=(ry==null?0:ry)+(rz==null?0:rz);
  var tx=Number(ps&&ps.tiltX)||0,ty=Number(ps&&ps.tiltY)||0;
  if(!tx&&!ty) return {x:90,y:0,z:heading};
  var R=Math.PI/180;
  var q=[[1,0,0,-90],[0,0,1,-heading],[1,0,0,tx],[0,1,0,ty]].map(function(v){var s=Math.sin(v[3]*R/2);return [v[0]*s,v[1]*s,v[2]*s,Math.cos(v[3]*R/2)];})
    .reduce(function(a,b){return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];});
  var x=q[0],y=q[1],z=q[2],w=q[3];
  var m11=1-2*(y*y+z*z),m13=2*(x*z+w*y),m21=2*(x*y+w*z),m22=1-2*(x*x+z*z),m23=2*(y*z-w*x),m31=2*(x*z-w*y),m33=1-2*(x*x+y*y);
  var ex=Math.asin(-Math.min(1,Math.max(-1,m23)));
  var locked=Math.abs(m23)>=0.9999999;
  var ey=locked?Math.atan2(-m31,m11):Math.atan2(m13,m33);
  var ez=locked?0:Math.atan2(m21,m22);
  return {x:-ex/R,y:-ey/R,z:-ez/R};
}
function _planStretch(ps){
  var sx=Number(ps&&ps.stretchX),sy=Number(ps&&ps.stretchY);
  return {x:isFinite(sx)&&sx>0?sx:1,y:isFinite(sy)&&sy>0?sy:1};
}
function _planDecalImage(shapes,bbox,color,opacity){
  var sz=_planDecalSize(bbox);var width=sz.width,height=sz.height;
  var w=(bbox.maxX-bbox.minX)||1;var h=(bbox.maxY-bbox.minY)||1;
  var sx=width/w,sy=height/h;
  var strokeWidth=Math.max(1.5,Math.min(width,height)/250);
  function px(x){return ((x-bbox.minX)*sx).toFixed(2);}
  function py(y){return (height-(y-bbox.minY)*sy).toFixed(2);}
  var paths='';
  (shapes||[]).forEach(function(shape){
    var pts=shape.pts;
    if(!pts||pts.length<2) return;
    var d=pts.map(function(p,i){return (i===0?'M':'L')+px(p[0])+','+py(p[1]);}).join(' ')
      +(shape.tag==='polygon'?' Z':'');
    paths+='<path d="'+d+'" fill="none" stroke="'+(color||'#111111')+'" stroke-width="'+strokeWidth+'"/>';
  });
  var body='<rect width="'+width+'" height="'+height+'" fill="#ffffff" fill-opacity="0.85"/>'+paths;
  var op=Number(opacity==null?1:opacity);
  var content=(isFinite(op)&&op<1)?'<g opacity="'+op+'">'+body+'</g>':body;
  var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'">'+content+'</svg>';
  return 'data:image/svg+xml,'+encodeURIComponent(svg);
}
// height/color are baked into an inline style attribute on the markup
// itself, not left to PSV's own marker style config -- that config gets
// applied via Object.assign(element.style, config.style) (a plain
// property assignment, not style.setProperty()), which doesn't reliably
// set CSS custom properties. An inline style="..." attribute, parsed by
// the browser while setting innerHTML, doesn't go through that code path.
function landmarkHtml(label,height,color,labelColor,animate,sublabel){
  var h=(typeof height==='number'&&isFinite(height))?height:48;
  // The editor's default stick colour becomes the tour's accent yellow; a
  // colour picked on purpose is kept.
  var c=/^#[0-9a-f]{6}$/i.test(color||'')&&color.toLowerCase()!=='#3730a3'?color:'#f5b800';
  var lc=/^#[0-9a-f]{6}$/i.test(labelColor||'')?labelColor:'#14141a';
  // lm-anim starts the line collapsed (see the .lm.lm-anim CSS rules) --
  // _updateLandmarkAnim adds lm-in-view the moment the camera pans this
  // landmark into the visible frame, which is what actually grows it.
  return '<div class="lm'+(animate?' lm-anim':'')+'" style="--lm-height:'+h+'px;--lm-color:'+c+';--lm-label-color:'+lc+'"><div class="lm-label">'+esc(label||'Landmark')+(sublabel?'<div><span class="lm-pill">'+esc(sublabel)+'</span></div>':'')+'</div><div class="lm-line"></div><div class="lm-dot"></div></div>';
}
// Built for the actionType 'info' case only -- fed straight into a marker's
// own config.content, which Photo Sphere Viewer's markers-plugin already
// shows automatically in its built-in side panel on every marker click
// (showMarkerPanel(), called internally before the select-marker listener
// below even runs) -- so no custom card DOM/CSS is needed here the way
// showZoneCard below has its own.
function hsInfoContent(h){
  var html='<div class="hs-info"><h3>'+esc(h.label||'')+'</h3>';
  (h.infoFields||[]).forEach(function(f){
    if(f.type==='image'){
      html+='<img src="'+esc(f.value)+'" alt="'+esc(f.label||'')+'">';
      if(f.label) html+='<p class="hs-caption">'+esc(f.label)+'</p>';
    }else if(f.type==='link'){
      html+='<a href="'+esc(f.value)+'" target="_blank" rel="noopener">'+esc(f.label||'Learn more')+'</a>';
    }else{
      if(f.label) html+='<p class="hs-field-label">'+esc(f.label)+'</p>';
      html+='<p>'+esc(f.value)+'</p>';
    }
  });
  html+='</div>';
  return html;
}
function arrowMarker(h){
  // Shared across every branch below: visible defaults a hotspot in/out of
  // the scene at load (a 'toggle' action later flips it via
  // mp.toggleMarker), and content -- ONLY set for actionType 'info' -- is
  // what makes PSV's own panel show something on click; every other action
  // type leaves it unset, so showMarkerPanel() silently no-ops for them.
  var extra={visible:!h.startHidden};
  if(h.actionType==='info') extra.content=hsInfoContent(h);
  var d={target:h.target,actionType:h.actionType,linkUrl:h.linkUrl,toggleTargetId:h.toggleTargetId,infoImageUrl:h.infoImageUrl,yaw:h.yaw,pitch:h.pitch};
  if(h.type==='landmark'){return Object.assign({id:'hs_'+h.id,type:'html',html:landmarkHtml(h.label,h.size,h.color,h.labelColor,h.animateLine,h.sublabel),anchor:'bottom center',position:{yaw:h.yaw+'deg',pitch:h.pitch+'deg'},data:d},extra);}
  // Floor decal: a real 3D plane (imageLayer), placed as a single point +
  // a 3-axis rotation object -- rotation.yaw/pitch/roll map to Y/X/Z axis
  // rotation respectively (confirmed from PSV's own Marker3D source), and
  // the base orientation before rotation is applied is position-
  // independent, so a given rotateX/rotateY/rotation value looks the same
  // everywhere on the sphere. size/100 is PSV's own world-scale factor
  // against the fixed sphere radius, a different unit than every other
  // arrow's screen-space pixel size, so it's scaled up by the same factor
  // as lib/arrows.js's FLOOR_SIZE_MULTIPLIER (kept in sync by hand -- this
  // plain string can't import that module). Mirrors middle.jsx's
  // arrowMarkers builder.
  if(h.type==='floor'){var fsz=h.size*2.5;return Object.assign({id:'hs_'+h.id,type:'imageLayer',imageLayer:h.gif,position:{yaw:h.yaw+'deg',pitch:h.pitch+'deg'},size:{width:fsz,height:fsz},rotation:{yaw:h.rotateY+'deg',pitch:h.rotateX+'deg',roll:(h.rotation||0)+'deg'},data:d},extra);}
  // Text decal: the SAME surface-embedded imageLayer mechanism as floor
  // above, except the image is generated from this hotspot's own
  // label/color (_textDecalImage) instead of a fixed sprite -- its aspect
  // ratio isn't 1:1 like floor's, so width/height below preserve it.
  if(h.type==='text'){
    var tsz=_textDecalSize(h.label);var taspect=tsz.width/tsz.height;var th=h.size*2.5;
    return Object.assign({id:'hs_'+h.id,type:'imageLayer',imageLayer:_textDecalImage(h.label,h.color),position:{yaw:h.yaw+'deg',pitch:h.pitch+'deg'},size:{width:th*taspect,height:th},rotation:{yaw:h.rotateY+'deg',pitch:h.rotateX+'deg',roll:(h.rotation||0)+'deg'},data:d},extra);
  }
  // Site plan decal: the SAME surface-embedded imageLayer mechanism as
  // floor/text above, except the image is the parsed DXF geometry rendered
  // as a line-drawing (_planDecalImage) instead of a fixed sprite or
  // generated text. A hotspot with no successfully-parsed plan (planShapes
  // null) renders nothing rather than throwing.
  if(h.type==='siteplan'){
    if(!h.planShapes) return null;
    var psz=_planDecalSize(h.planShapes.bbox);var paspect=psz.width/psz.height;var ph=h.size*2.5;
    var pr=_planRenderRotation(h.planShapes,h.rotateX,h.rotateY,h.rotation);
    var pst=_planStretch(h.planShapes);
    return Object.assign({id:'hs_'+h.id,type:'imageLayer',imageLayer:_planDecalImage(h.planShapes.shapes,h.planShapes.bbox,h.color,h.planShapes.opacity),position:{yaw:h.yaw+'deg',pitch:h.pitch+'deg'},size:{width:ph*paspect*pst.x,height:ph*pst.y},rotation:{yaw:pr.y+'deg',pitch:pr.x+'deg',roll:pr.z+'deg'},data:d},extra);
  }
  // Pulse ring stays a plain billboard (a true 3D marker would freeze its
  // pulse animation to one static frame) but X/Y still get a real visible
  // effect via a CSS transform on the marker element -- the transform
  // property (unlike rotate/translate, which PSV's own 2D markers already
  // use for Z-rotation/position) is never touched by PSV's marker code for
  // this type, so it's free for a cosmetic perspective tilt. Mirrors
  // middle.jsx's arrowMarkers builder exactly.
  if(h.type==='pulse'){return Object.assign({id:'hs_'+h.id,type:'image',image:h.gif,size:{width:h.size,height:h.size},position:{yaw:h.yaw+'deg',pitch:h.pitch+'deg'},rotation:(h.rotation||0)+'deg',tooltip:h.label||undefined,style:{transform:'perspective(600px) rotateX('+h.rotateX+'deg) rotateY('+h.rotateY+'deg)'},data:d},extra);}
  return Object.assign({id:'hs_'+h.id,type:'image',image:h.customIconUrl||h.gif,size:{width:h.size,height:h.size},position:{yaw:h.yaw+'deg',pitch:h.pitch+'deg'},rotation:(h.rotation||0)+'deg',tooltip:h.label||undefined,data:d},extra);
}
function coverMarker(c,baseHfov){return {id:'cv_'+c.id,type:'image',image:c.url,size:{width:c.size,height:c.size},position:{yaw:c.yaw+'deg',pitch:c.pitch+'deg'},opacity:c.opacity,rotation:c.rotation+'deg',scale:function(zl){try{return baseHfov/viewer.dataHelper.zoomLevelToFov(zl);}catch(e){return 1;}}};}
function zoneMarker(z){return {id:'poly_'+z.id,type:'polygon',polygon:z.points.map(function(pt){return [pt[0]+'deg',pt[1]+'deg'];}),svgStyle:{fill:z.color+_alphaHex(z.fillOpacity),stroke:z.borderColor||z.color,strokeWidth:'2'},visible:_zoneShown(z),tooltip:_zoneTip(z),data:z};}
// The zone's own label as an always-visible badge at its centre -- the
// plot-number pill a site plan lives on. Plain arithmetic centroid, same
// simplification lib/polygons.js's centroidOf() documents (not seam-aware),
// fine for the compact shapes this is for. Non-interactive (pointer-events
// :none in CSS) so it never steals the zone's own click.
function zoneLabelMarker(z){
  if(!z.showLabel||!z.label)return null;
  var n=z.points.length;if(!n)return null;
  var cy=0,cp=0;for(var i=0;i<n;i++){cy+=z.points[i][0];cp+=z.points[i][1];}cy/=n;cp/=n;
  var txt=_plotText(z.label);
  var st=' style="--zc:'+z.color+';'+(z.labelStyle||'')+'"';
  return {id:'zlabel_'+z.id,type:'html',html:'<div class="zone-label'+(txt.length>3?' zl-long':'')+'"'+st+'>'+esc(txt)+'</div>',anchor:'center center',position:{yaw:cy+'deg',pitch:cp+'deg'},visible:_zoneShown(z),style:{pointerEvents:'none'}};
}
function markersFor(id){
  var s=TOURS[id];
  // Paint order, first (bottom) to last (top): cover-ups, zone fills, every
  // zone label, then the arrows -- so a navigation arrow is never hidden
  // behind a plot-number badge. Mirrors middle.jsx's own marker order.
  var out=s.covers.map(function(c){return coverMarker(c,s.hfov);}).concat(s.zones.map(zoneMarker));
  s.zones.forEach(function(z){
    var zl=zoneLabelMarker(z);if(zl)out.push(zl);
  });
  return out.concat(s.arrows.map(arrowMarker).filter(Boolean));
}

var _l=0,_t=SM.length;
function _onLoad(){_l++;var p=Math.round(_l/_t*100);document.getElementById('loadPct').textContent='Loading\\u2026 '+p+'%';document.getElementById('loadFill').style.width=p+'%';if(_l>=_t)setTimeout(function(){document.getElementById('loadOverlay').style.display='none';},400);}
if(_t===0){document.getElementById('loadOverlay').style.display='none';}else{SM.forEach(function(s){var i=new Image();i.onload=i.onerror=_onLoad;i.src=s.url;});}

var first=SM.length?SM[0].id:null;
var viewer=new Viewer({
  container: document.getElementById('viewer'),
  panorama: first?TOURS[first].panorama:undefined,
  defaultYaw:(first?TOURS[first].yaw:0)+'deg',
  defaultPitch:(first?TOURS[first].pitch:0)+'deg',
  minFov:30,maxFov:130,navbar:false,
  plugins:[[MarkersPlugin,{}],[GyroscopePlugin,{}]${autorotatePluginEntry}],
});
var mp=viewer.getPlugin(MarkersPlugin);

viewer.addEventListener('ready',function(){
  if(!first)return;
  try{viewer.zoom(viewer.dataHelper.fovToZoomLevel(TOURS[first].hfov));}catch(e){}
  mp.setMarkers(markersFor(first));
  _onScene(first);
},{once:true});

function loadScene(id){
  var s=TOURS[id];
  // Position/zoom go IN the setPanorama call, not as a manual rotate()/zoom()
  // snap afterward -- PSV's default transition (fade + smooth rotation toward
  // the target, ~1.5s) animates both together as one motion. Doing it as two
  // steps meant a fade-in at whatever angle, then a sudden jump-cut rotate,
  // which reads as janky rather than smooth.
  var opts={position:{yaw:s.yaw+'deg',pitch:s.pitch+'deg'}};
  try{opts.zoom=viewer.dataHelper.fovToZoomLevel(s.hfov);}catch(e){}
  viewer.setPanorama(s.panorama,opts).then(function(){
    mp.setMarkers(markersFor(id));
    _onScene(id);
  });
}
// "Transport" transition for a hotspot's own Go-to-scene click -- a 3DVista-
// style push-in rather than PSV's default fade: rotate+zoom IN toward the
// clicked hotspot's own direction, swap the panorama at the peak of that
// zoom with PSV's own transition turned off (we're already doing our own),
// then zoom back OUT to a normal view WITHOUT rotating -- you keep facing
// the same direction you pushed in on, reading as walking straight through
// the hotspot into the next space, rather than snapping to that scene's own
// saved opening angle. The zone-click navigate path and the scene-sidebar
// thumbnails deliberately keep the plain loadScene() above -- neither has a
// single "this is the direction to push toward" point the way a hotspot,
// placed exactly where you'd walk through, does.
//
// Zoom target is relative to whatever zoom you were ALREADY at (+28,
// capped at 92) rather than a fixed number -- "zoom a little bit" reads
// very differently if you were already zoomed in versus at a wide FOV, and
// a relative bump keeps the push-in feeling proportional either way.
function loadSceneViaHotspot(id,hYaw,hPitch){
  var s=TOURS[id];
  if(!s)return;
  var startZoom=viewer.getZoomLevel();
  var pushZoom=Math.min(92,startZoom+28);
  var pos={yaw:hYaw+'deg',pitch:hPitch+'deg'};
  viewer.animate({yaw:pos.yaw,pitch:pos.pitch,zoom:pushZoom,speed:450}).then(function(){
    return viewer.setPanorama(s.panorama,{position:pos,zoom:pushZoom,transition:false,showLoader:false});
  }).then(function(){
    mp.setMarkers(markersFor(id));
    _onScene(id);
    var restZoom=startZoom;
    try{restZoom=viewer.dataHelper.fovToZoomLevel(s.hfov);}catch(e){}
    return viewer.animate({zoom:restZoom,speed:450});
  });
}
// mailto:/tel: aren't real navigable pages, so they replace the current tab
// (a new tab left blank behind them is just confusing); everything else
// opens in a new tab so the tour itself stays open underneath.
function openLink(url){
  if(!url)return;
  if(url.indexOf('mailto:')===0||url.indexOf('tel:')===0){location.href=url;}
  else{window.open(url,'_blank','noopener');}
}
// display:flex is set a frame before .show is added (a display:none element
// can't transition) -- the double rAF makes sure the browser has actually
// painted that display change before the opacity/scale transition starts,
// otherwise both changes can get batched into the same frame and the fade+
// scale-in never visibly plays.
function showImageLightbox(url){
  if(!url)return;
  document.getElementById('imgLbImg').src=url;
  var lb=document.getElementById('imgLightbox');
  lb.style.display='flex';
  requestAnimationFrame(function(){requestAnimationFrame(function(){lb.classList.add('show');});});
}
function hideImageLightbox(){
  var lb=document.getElementById('imgLightbox');
  if(lb.style.display==='none')return;
  lb.classList.remove('show');
  setTimeout(function(){lb.style.display='none';document.getElementById('imgLbImg').src='';},250);
}
window.hideImageLightbox=hideImageLightbox;
document.getElementById('imgLbClose').addEventListener('click',hideImageLightbox);
document.getElementById('imgLightbox').addEventListener('click',function(e){if(e.target.id==='imgLightbox')hideImageLightbox();});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){hideImageLightbox();hideZoneCard();}});
mp.addEventListener('select-marker',function(ev){
  var m=ev.marker;
  if(m.id.indexOf('hs_')===0 && m.data){
    var d=m.data,t=d.actionType||'navigate';
    // 'info' needs nothing here -- PSV's own showMarkerPanel() already
    // opened the content panel (set via arrowMarker's config.content)
    // before this listener even runs.
    if(t==='navigate' && d.target) loadSceneViaHotspot(d.target,d.yaw,d.pitch);
    else if(t==='link') openLink(d.linkUrl);
    else if(t==='image') showImageLightbox(d.infoImageUrl);
    // toggleMarker is a built-in MarkersPlugin method -- no manual
    // visible-state tracking needed.
    else if(t==='toggle' && d.toggleTargetId) mp.toggleMarker('hs_'+d.toggleTargetId);
  }
  if(m.id.indexOf('poly_')===0 && m.data){
    var z=m.data,zt=z.actionType||'info';
    if(zt==='navigate' && z.target) loadScene(z.target);
    else if(zt==='link') openLink(z.linkUrl);
    else if(zt==='image') showImageLightbox(z.infoImageUrl);
    else if(zt==='toggle' && z.toggleTargetId) mp.toggleMarker('hs_'+z.toggleTargetId);
    // "Show status & details" with literally nothing added (no Details keys,
    // no Card contents fields) has nothing to show -- opening the card
    // anyway just produced an empty dark box with a close button, which is
    // more confusing than doing nothing. A zone left at its default action
    // with no content configured (e.g. a purely decorative "Road" area) now
    // behaves like it has no click action at all.
    else if(Object.keys(z.detail||{}).length||(z.infoFields||[]).length) showZoneCard(z);
  }
});
mp.addEventListener('enter-marker',function(ev){
  var m=ev.marker;
  if(m.id.indexOf('poly_')!==0||!m.data)return;
  mp.updateMarker({id:m.id,svgStyle:{fill:(m.data.hoverColor||m.data.color)+_alphaHex(m.data.hoverOpacity),stroke:m.data.borderColor||m.data.color,strokeWidth:'3'}});
});
mp.addEventListener('leave-marker',function(ev){
  var m=ev.marker;
  if(m.id.indexOf('poly_')!==0||!m.data)return;
  mp.updateMarker({id:m.id,svgStyle:{fill:m.data.color+_alphaHex(m.data.fillOpacity),stroke:m.data.borderColor||m.data.color,strokeWidth:'2'}});
});
// Landmark "grow in" line -- toggles lm-in-view (see the .lm.lm-anim CSS
// rules) on each animated landmark's own marker element once its point is
// well inside the visible frame (not merely touching the screen edge --
// see _INVIEW_MARGIN), and off again once it drifts back out -- so the
// line replays every time it leaves and re-enters view, not just once on
// first load, and the same transition (defined once, on the base .lm-line
// rule) runs in reverse on the way out, no separate "backward" animation
// needed. Driven off the SAME camera events (position/zoom) PSV itself
// fires for every pan/zoom/auto-rotate tick, rather than a polling loop.
var _curScene=null;
// Fraction of the viewport inset on the LEFT/RIGHT edges before a landmark
// counts as "in view" -- 0 would trigger the instant it touches the literal
// edge (the old behavior); 0.25 means it has to clear a quarter of the
// screen's width inward first, so the animation reads as reacting to the
// landmark panning properly into frame, not just barely peeking into it.
// Vertical position is deliberately NOT checked -- a landmark near the top
// or bottom edge (but horizontally centered) still counts as in view, since
// the trigger is meant to react to left/right camera panning only, the axis
// you actually navigate a tour with, not looking up/down. The SAME
// horizontal boundary is used both ways (no separate enter/exit thresholds).
var _INVIEW_MARGIN=0.25;
function _updateLandmarkAnim(){
  var s=_curScene&&TOURS[_curScene];
  if(!s)return;
  var host=document.getElementById('viewer');
  var vw=host?host.clientWidth:window.innerWidth;
  var mx=vw*_INVIEW_MARGIN;
  s.arrows.forEach(function(h){
    if(h.type!=='landmark'||!h.animateLine)return;
    var marker;
    try{marker=mp.getMarker('hs_'+h.id);}catch(e){marker=null;}
    var el=marker&&marker.domElement&&marker.domElement.querySelector('.lm');
    if(!el)return;
    var inView=false;
    try{
      var pt=viewer.dataHelper.sphericalCoordsToViewerCoords({yaw:h.yaw*Math.PI/180,pitch:h.pitch*Math.PI/180});
      inView=!!pt&&pt.x>=mx&&pt.x<=vw-mx;
    }catch(e){}
    el.classList.toggle('lm-in-view',inView);
  });
}
viewer.addEventListener('position-updated',_updateLandmarkAnim);
viewer.addEventListener('zoom-updated',_updateLandmarkAnim);
// Zone-label auto-hide -- a plot-number badge shows only while its own zone
// is actually big enough on screen to hold it, so zooming out over a
// 150-plot site plan doesn't pile every badge into unreadable mush.
// Measuring each zone's own projected size (rather than thresholding the
// camera's zoom level) needs no setting and no per-tour tuning: it adapts to
// however big each individual plot happens to be at the current zoom.
// Mirrors middle.jsx's zoneFitsLabel, including erring toward SHOWING when a
// point won't project. updateMarker is called only when a badge's visibility
// actually flips -- it's a real marker mutation that fires a set-markers
// event, so doing it on every camera event unconditionally would be heavy.
var _LABEL_BADGE_H=28,_zlVis={};
function _zoneFitsLabel(z){
  var minX=1/0,maxX=-1/0,minY=1/0,maxY=-1/0;
  for(var i=0;i<z.points.length;i++){
    var pt;
    try{pt=viewer.dataHelper.sphericalCoordsToViewerCoords({yaw:z.points[i][0]*Math.PI/180,pitch:z.points[i][1]*Math.PI/180});}catch(e){return true;}
    if(!pt)return true;
    if(pt.x<minX)minX=pt.x;
    if(pt.x>maxX)maxX=pt.x;
    if(pt.y<minY)minY=pt.y;
    if(pt.y>maxY)maxY=pt.y;
  }
  var len=_plotText(z.label).length||1;
  return (maxX-minX)>=Math.max(32,len*8+14)&&(maxY-minY)>=_LABEL_BADGE_H;
}
function _updateZoneLabels(){
  var s=_curScene&&TOURS[_curScene];
  if(!s)return;
  s.zones.forEach(function(z){
    if(!z.showLabel||!z.label)return;
    var fits=_zoneFitsLabel(z);
    if(_zlVis[z.id]===fits)return;
    _zlVis[z.id]=fits;
    try{mp.updateMarker({id:'zlabel_'+z.id,visible:fits&&_zoneShown(z)});}catch(e){}
  });
}
viewer.addEventListener('position-updated',_updateZoneLabels);
viewer.addEventListener('zoom-updated',_updateZoneLabels);
// Plot-dimension labels -- one persistent DOM node per edge that has a
// length typed in, positioned in real screen space on every camera event
// instead of anchored to a single (yaw,pitch) marker position. PSV renders
// a polygon's edges as straight lines between the two corners' CURRENT
// screen projections, not a spherical geodesic, so only a live reprojection
// like this stays glued to the actual rendered edge through pan/zoom -- a
// static marker anchored at the naive degree-average of the two corners
// (what shipped originally) drifts toward the shape's centre instead, which
// is visibly wrong for anything but a very small/distant zone. Plain
// position:fixed divs (same convention as .wm's own layer) rather than PSV
// markers, since PSV has no "recompute every camera event" declarative
// marker type -- mirrors middle.jsx's own editor-side fix exactly.
//
// Repositioning runs off a dedicated requestAnimationFrame loop below, NOT
// PSV's own 'position-updated'/'zoom-updated' events -- those are driven by
// PSV's internal eased "Dynamic" value tween and are NOT guaranteed to fire
// on every rendered frame of a raw mouse-drag pan the way rAF is. Relying on
// them shipped a real bug: mid-drag, PSV keeps repositioning every OTHER
// marker itself (that's internal, per-frame, and doesn't go through these
// events at all), while these plain DOM labels only moved on whatever
// cadence position-updated happened to fire at -- so panning across a
// labeled zone could leave its dimension text frozen in place, visibly
// detached from the zone sliding underneath it, exactly the symptom
// reported. middle.jsx's own version never had this bug because it was
// already built on a real rAF loop from the start (see mainLoop there) --
// this just gives the published tour the same guarantee.
var _elLayer=null,_elEls={},_elCamKey=null;
function _edgeLabelSlots(s){
  var out=[];
  s.zones.forEach(function(z){
    var lens=z.edgeLengths||[];
    for(var i=0;i<z.points.length;i++){if(lens[i])out.push({z:z,i:i,label:lens[i]});}
  });
  return out;
}
function _rebuildEdgeLabels(){
  if(!_elLayer){_elLayer=document.createElement('div');_elLayer.id='elLayer';document.body.appendChild(_elLayer);}
  _elLayer.innerHTML='';_elEls={};
  var s=_curScene&&TOURS[_curScene];
  if(!s)return;
  _edgeLabelSlots(s).forEach(function(slot){
    var d=document.createElement('div');
    d.className='edge-label';
    d.textContent=slot.label;
    d.style.display='none';
    _elLayer.appendChild(d);
    _elEls[slot.z.id+'_'+slot.i]=d;
  });
  _elCamKey=null;
  _updateEdgeLabels();
}
// PSV projects a point behind the camera to a mirrored screen position
// rather than null, which sent labels for out-of-view edges into empty sky.
function _inFront(pt,cam){
  var y=pt[0]*_DEG,p=pt[1]*_DEG;
  return Math.cos(p)*Math.cos(cam.pitch)*Math.cos(y-cam.yaw)+Math.sin(p)*Math.sin(cam.pitch)>0.05;
}
function _updateEdgeLabels(){
  var s=_curScene&&TOURS[_curScene];
  if(!s)return;
  _edgeLabelSlots(s).forEach(function(slot){
    var el=_elEls[slot.z.id+'_'+slot.i];
    if(!el)return;
    if(!_zoneShown(slot.z)){el.style.display='none';return;}
    var a=slot.z.points[slot.i],b=slot.z.points[(slot.i+1)%slot.z.points.length];
    var pa=null,pb=null;
    try{
      var cam=viewer.getPosition();
      if(!_inFront(a,cam)||!_inFront(b,cam))throw 0;
      pa=viewer.dataHelper.sphericalCoordsToViewerCoords({yaw:a[0]*Math.PI/180,pitch:a[1]*Math.PI/180});
      pb=viewer.dataHelper.sphericalCoordsToViewerCoords({yaw:b[0]*Math.PI/180,pitch:b[1]*Math.PI/180});
    }catch(e){}
    if(pa&&pb){
      el.style.display='';
      el.style.left=((pa.x+pb.x)/2)+'px';
      el.style.top=((pa.y+pb.y)/2)+'px';
    }else{
      el.style.display='none';
    }
  });
}
// Gated on a cheap camera fingerprint, same reasoning as middle.jsx's own
// zone-label auto-hide -- the projection math only runs on frames where the
// view actually changed, not unconditionally 60 times a second.
function _edgeLabelLoop(){
  if(_curScene&&TOURS[_curScene]){
    var camKey=null;
    try{
      var pos=viewer.getPosition();
      camKey=Math.round(pos.yaw*1e3)+'|'+Math.round(pos.pitch*1e3)+'|'+Math.round(viewer.getZoomLevel()*100);
    }catch(e){}
    if(camKey&&camKey!==_elCamKey){
      _elCamKey=camKey;
      _updateEdgeLabels();
    }
  }
  requestAnimationFrame(_edgeLabelLoop);
}
requestAnimationFrame(_edgeLabelLoop);
function hideZoneCard(){document.getElementById('zoneCard').style.display='none';document.getElementById('zoneCardBackdrop').style.display='none';}
window.hideZoneCard=hideZoneCard;
function showZoneCard(z){
  var images=document.getElementById('zcImages');
  var body=document.getElementById('zcDetail');
  images.innerHTML='';body.innerHTML='';
  Object.keys(z.detail||{}).forEach(function(k){
    var row=document.createElement('div');row.className='zc-row';
    var a=document.createElement('span');a.textContent=k;
    var b=document.createElement('span');b.textContent=String(z.detail[k]);
    row.appendChild(a);row.appendChild(b);body.appendChild(row);
  });
  // Optional extras shared with the hotspot info card (same action-system
  // fields, same InfoFieldsEditor-built list) -- absent on every zone that
  // predates this, so nothing renders when the list is empty. Images go into
  // their own unpadded container (see #zcImages/.zc-image CSS for why --
  // sized to their own natural dimensions, never a fixed box), everything
  // else into the padded/dark #zcDetail.
  (z.infoFields||[]).forEach(function(f){
    if(f.type==='image'){
      var img=document.createElement('img');img.className='zc-image';img.src=f.value;img.alt=f.label||'';
      images.appendChild(img);
      if(f.label){var cap=document.createElement('p');cap.className='zc-caption';cap.textContent=f.label;images.appendChild(cap);}
    }else if(f.type==='link'){
      var link=document.createElement('a');link.className='zc-link';link.href=f.value;link.target='_blank';link.rel='noopener';link.textContent=f.label||'Learn more';
      body.appendChild(link);
    }else{
      if(f.label){var lbl=document.createElement('p');lbl.className='zc-field-label';lbl.textContent=f.label;body.appendChild(lbl);}
      var txt=document.createElement('p');txt.className='zc-body';txt.textContent=f.value;body.appendChild(txt);
    }
  });
  // Hidden rather than left as an empty padded box when there's no non-image
  // content at all -- an image-only card (the common case) should show
  // nothing but the image. zc-solo (full corner radius, not just the bottom
  // two) applies whenever there's no image above it to square off against.
  body.style.display=body.children.length?'':'none';
  body.classList.toggle('zc-solo',!images.children.length);
  document.getElementById('zoneCard').style.display='block';
  document.getElementById('zoneCardBackdrop').style.display='block';
}
document.getElementById('zoneCardBackdrop').addEventListener('click',hideZoneCard);

SM.forEach(function(s){var d=document.createElement('div');d.className='ss-item';d.dataset.id=s.id;var img=document.createElement('img');img.src=s.url;img.alt=s.name;var lbl=document.createElement('span');lbl.textContent=s.name;d.appendChild(img);d.appendChild(lbl);d.addEventListener('click',function(){loadScene(s.id);});document.getElementById('sceneSidebar').appendChild(d);});
function _hl(id){document.querySelectorAll('.ss-item').forEach(function(el){el.classList.toggle('active',el.dataset.id===id);});}
var LOGOS=${logoData};
function _clampWM(el,l){var host=document.getElementById('viewer')||document.body;var vw=host.clientWidth||1,vh=host.clientHeight||1;var bw=el.offsetWidth||l.w,bh=el.offsetHeight||l.w;var hx=(bw/2/vw)*100,hy=(bh/2/vh)*100;var x=hx*2>=100?50:Math.min(100-hx,Math.max(hx,l.x));var y=hy*2>=100?50:Math.min(100-hy,Math.max(hy,l.y));el.style.left=x+'%';el.style.top=y+'%';}
var _WMCUR=[];
function _wm(id){var layer=document.getElementById('wmLayer');if(!layer)return;layer.innerHTML='';_WMCUR=[];LOGOS.forEach(function(l){if(l.s!=null&&l.s!==id)return;var d=document.createElement('div');d.className='wm';d.style.cssText='left:'+l.x+'%;top:'+l.y+'%;width:'+l.w+'px;opacity:'+l.o+';';var img=document.createElement('img');img.src=l.u;img.alt='';img.onload=function(){_clampWM(d,l);};d.appendChild(img);layer.appendChild(d);_WMCUR.push({el:d,l:l});_clampWM(d,l);});}
function _reclampWM(){_WMCUR.forEach(function(o){_clampWM(o.el,o.l);});}
window.addEventListener('resize',_reclampWM);
// _zlVis is reset here, not merged: loadScene rebuilt every marker, so a
// badge's visibility from the previous scene no longer describes anything.
function _onScene(id){_curScene=id;_hl(id);_wm(id);hideZoneCard();_updateLandmarkAnim();_zlVis={};_updateZoneLabels();_rebuildEdgeLabels();_renderChrome(id);}
// ── Tour chrome: badge, top buttons, right rail, legend, plot strip ──────
var _DEG=Math.PI/180;
var _hiddenStatus={},_minSize=0;
function _zoneShown(z){
  if(z.startHidden||_hiddenStatus[z.status])return false;
  return !(_minSize>0&&z.label&&!(z.sizeNum>=_minSize));
}
// "Plot 13 · 9,806 sq.ft · Available" on hover.
function _zoneTip(z){
  if(!z.label)return undefined;
  var name=/^[0-9]/.test(z.label)?'Plot '+z.label:z.label;
  return '<b>'+esc(name)+'</b>'+(z.sizeText?' · '+esc(z.sizeText):'')+' · '+esc(_statusName(z.status));
}
// "Plot 36A" -> "36A" for the bubble and strip; other labels unchanged.
function _plotText(label){return String(label||'').replace(/^plot +/i,'');}
function _stripText(label){var t=_plotText(label);return /^[0-9]$/.test(t)?'0'+t:t;}
function _natKey(label){var t=_plotText(label);var m=t.match(/^([0-9]+)(.*)$/);return m?[Number(m[1]),m[2]]:[1e9,t];}
function _statusColor(st){return STATUS_COLORS[st]||'#6366f1';}
function _statusName(st){st=String(st||'');return st.charAt(0).toUpperCase()+st.slice(1);}
function _show(id,on){var el=document.getElementById(id);if(el)el.style.display=on?'':'none';}

// Brand badge + the contact buttons (each hidden when its field is empty).
(function(){
  var n=BRAND.name||'',words=n.split(' ').filter(Boolean);
  var ini=((words[0]||'').charAt(0)+(words[1]||'').charAt(0)).toUpperCase()||'?';
  var mark=document.getElementById('brandMark');
  if(BRAND.logo){var im=document.createElement('img');im.src=BRAND.logo;im.alt='';mark.appendChild(im);}else{mark.textContent=ini;}
  document.getElementById('brandName').textContent=n;
  document.getElementById('brandSub').textContent=BRAND.subtitle||'';
  _show('brandSub',!!BRAND.subtitle);
  _show('tbEnquiryW',!!BRAND.whatsapp);
  _show('tbCallW',!!BRAND.phone);
  _show('tbLocationW',!!BRAND.maps);
  document.getElementById('tbEnquiry').addEventListener('click',function(){
    window.open('https://wa.me/'+BRAND.whatsapp+'?text='+encodeURIComponent('Hi, I am interested in '+n+'.'),'_blank','noopener');
  });
  document.getElementById('tbCall').addEventListener('click',function(){location.href='tel:'+BRAND.phone.split(' ').join('');});
  document.getElementById('tbLocation').addEventListener('click',function(){window.open(BRAND.maps,'_blank','noopener');});
})();

// Dropdowns (Filter, Nearby): one open at a time, closed by an outside click.
function _closeDropdowns(except){document.querySelectorAll('.dd.open').forEach(function(d){if(d!==except)d.classList.remove('open');});_syncTb();}
function _syncTb(){
  document.getElementById('tbFilter').classList.toggle('on',document.getElementById('ddFilter').classList.contains('open'));
  document.getElementById('tbNearby').classList.toggle('on',document.getElementById('nearbyPanel').classList.contains('open'));
}
function _setNearby(open){document.getElementById('nearbyPanel').classList.toggle('open',open);_syncTb();}
(function(){
  var dd=document.getElementById('ddFilter'),np=document.getElementById('nearbyPanel');
  document.getElementById('tbFilter').addEventListener('click',function(e){
    e.stopPropagation();var open=!dd.classList.contains('open');
    _setNearby(false);dd.classList.toggle('open',open);_syncTb();
  });
  dd.addEventListener('click',function(e){e.stopPropagation();});
  document.getElementById('tbNearby').addEventListener('click',function(e){
    e.stopPropagation();var open=!np.classList.contains('open');
    _closeDropdowns(null);_setNearby(open);
  });
  document.getElementById('npClose').addEventListener('click',function(){_setNearby(false);});
})();
document.addEventListener('click',function(){_closeDropdowns(null);});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){_closeDropdowns(null);_setNearby(false);}});

// Camera moves. animate() eases yaw, pitch and zoom together, so a move
// from the top view to the landmarks reads as one smooth tilt-and-turn.
function _stopAuto(){try{var ar=viewer.getPlugin('autorotate');if(ar)ar.stop();}catch(e){}}
function _fly(yaw,pitch,hfov,ms){
  _stopAuto();
  var o={yaw:yaw+'deg',pitch:Math.max(-89.9,Math.min(89.9,pitch))+'deg',speed:ms||1600};
  if(hfov){try{o.zoom=viewer.dataHelper.fovToZoomLevel(Math.max(30,Math.min(130,hfov)));}catch(e){}}
  return viewer.animate(o);
}
function _camYawDeg(){try{return viewer.getPosition().yaw/_DEG;}catch(e){return 0;}}
function _landmarks(s){return (s&&s.arrows||[]).filter(function(h){return h.type==='landmark'&&!h.startHidden;});}
function topView(){
  var s=_curScene&&TOURS[_curScene];if(!s)return;
  var t=s.top||{yaw:_camYawDeg(),pitch:-89.9,hfov:s.hfov};
  _fly(t.yaw,t.pitch,t.hfov,1800);
}
// Frames every landmark: centre on their average direction (circular mean,
// so landmarks either side of the 0/360 seam average correctly), aim a
// little above them since the callouts rise up from their points, and
// widen the view enough to fit their spread.
function lookAround(){
  var s=_curScene&&TOURS[_curScene];if(!s)return;
  var lm=_landmarks(s);
  if(!lm.length){_fly(_camYawDeg(),0,90,2200);return;}
  var sx=0,cx=0,p=0;
  lm.forEach(function(h){sx+=Math.sin(h.yaw*_DEG);cx+=Math.cos(h.yaw*_DEG);p+=h.pitch;});
  var yaw=Math.atan2(sx,cx)/_DEG;p/=lm.length;
  var spread=0;
  lm.forEach(function(h){var d=Math.abs(((h.yaw-yaw)%360+540)%360-180);if(d>spread)spread=d;});
  _fly(yaw,Math.max(-30,Math.min(20,p+10)),Math.max(60,Math.min(115,spread*2+40)),2400);
}
function flyToLandmark(h){_fly(h.yaw,Math.min(30,h.pitch+12),70,1400);}
var _activePlot=null;
function flyToZone(z){
  var n=z.points.length;if(!n)return;
  var sx=0,cx=0,p=0;
  z.points.forEach(function(pt){sx+=Math.sin(pt[0]*_DEG);cx+=Math.cos(pt[0]*_DEG);p+=pt[1];});
  _activePlot=z.id;_markActivePlot();
  _fly(Math.atan2(sx,cx)/_DEG,p/n,null,1100).then(function(){
    // Briefly highlight the plot so it's obvious which one was picked.
    try{mp.updateMarker({id:'poly_'+z.id,svgStyle:{fill:(z.hoverColor||z.color)+_alphaHex(z.hoverOpacity),stroke:z.borderColor||z.color,strokeWidth:'3'}});}catch(e){}
    setTimeout(function(){try{mp.updateMarker({id:'poly_'+z.id,svgStyle:{fill:z.color+_alphaHex(z.fillOpacity),stroke:z.borderColor||z.color,strokeWidth:'2'}});}catch(e){}},1600);
    if(Object.keys(z.detail||{}).length||(z.infoFields||[]).length)showZoneCard(z);
  });
}
function _markActivePlot(){document.querySelectorAll('.pl').forEach(function(b){b.classList.toggle('active',b.dataset.id===_activePlot);});}

// Filter: hiding a status hides its plots, their bubbles and edge labels,
// and dims them in the strip.
function _applyFilter(){
  var s=_curScene&&TOURS[_curScene];if(!s)return;
  s.zones.forEach(function(z){try{mp.updateMarker({id:'poly_'+z.id,visible:_zoneShown(z)});}catch(e){}});
  _zlVis={};_updateZoneLabels();_elCamKey=null;_updateEdgeLabels();
  document.querySelectorAll('.pl').forEach(function(b){var z=s.zones.find(function(q){return q.id===b.dataset.id;});b.classList.toggle('dim',!!z&&!_zoneShown(z));});
}

// Per-scene parts: legend counts, plot strip, Filter and Nearby lists.
function _renderChrome(id){
  var s=TOURS[id];if(!s)return;
  var plots=s.zones.filter(function(z){return z.label&&!z.startHidden;});
  plots.sort(function(a,b){var ka=_natKey(a.label),kb=_natKey(b.label);return ka[0]-kb[0]||String(ka[1]).localeCompare(String(kb[1]));});
  var counts={};plots.forEach(function(z){counts[z.status]=(counts[z.status]||0)+1;});
  var order=['available','booked','sold'];
  Object.keys(counts).forEach(function(st){if(order.indexOf(st)<0)order.push(st);});
  var lg=document.getElementById('legend');lg.innerHTML='';
  order.forEach(function(st){
    var sp=document.createElement('span');
    var dot=document.createElement('i');dot.style.background=_statusColor(st);
    var t=document.createElement('span');t.textContent=_statusName(st);
    var b=document.createElement('b');b.textContent=String(counts[st]||0);
    sp.appendChild(dot);sp.appendChild(t);sp.appendChild(b);lg.appendChild(sp);
  });
  _show('legend',plots.length>0);
  var strip=document.getElementById('strip');strip.innerHTML='';
  plots.forEach(function(z){
    var btn=document.createElement('button');btn.type='button';btn.className='pl';btn.dataset.id=z.id;btn.dataset.status=z.status;
    btn.title=z.label+' - '+_statusName(z.status);
    var t=document.createElement('span');t.textContent=_stripText(z.label);
    var u=document.createElement('i');u.style.background=z.color;
    btn.appendChild(t);btn.appendChild(u);
    btn.addEventListener('click',function(){flyToZone(z);});
    strip.appendChild(btn);
  });
  _show('strip',plots.length>0);
  var maxSize=0;plots.forEach(function(z){if(z.sizeNum>maxSize)maxSize=z.sizeNum;});
  if(_minSize>maxSize)_minSize=0;
  var fd=document.getElementById('ddFilter');fd.innerHTML='';
  var ft=document.createElement('div');ft.className='fp-title';ft.textContent='Filter plots';fd.appendChild(ft);
  var fl=document.createElement('div');fl.className='fp-label';fl.textContent='Status';fd.appendChild(fl);
  order.forEach(function(st){
    var row=document.createElement('label');row.className='dd-item';
    var cb=document.createElement('input');cb.type='checkbox';cb.checked=!_hiddenStatus[st];
    cb.addEventListener('change',function(){_hiddenStatus[st]=!cb.checked;_applyFilter();});
    var dot=document.createElement('span');dot.className='dd-dot';dot.style.background=_statusColor(st);
    var t=document.createElement('span');t.textContent=_statusName(st);
    row.appendChild(cb);row.appendChild(dot);row.appendChild(t);fd.appendChild(row);
  });
  // Minimum size only appears once plots have a size in their Details.
  if(maxSize>0){
    var sl=document.createElement('div');sl.className='fp-label';sl.textContent='Minimum size';fd.appendChild(sl);
    var rng=document.createElement('input');rng.type='range';rng.className='fp-slider';rng.min='0';rng.max=String(maxSize);rng.step=String(Math.max(1,Math.round(maxSize/100)));rng.value=String(_minSize);fd.appendChild(rng);
    var ends=document.createElement('div');ends.className='fp-ends';
    var e1=document.createElement('span');e1.textContent='Any';
    var e2=document.createElement('span');
    var fmt=function(){e2.textContent=_minSize>0?_minSize.toLocaleString('en-IN')+'+ sq.ft':'Any size';};
    fmt();ends.appendChild(e1);ends.appendChild(e2);fd.appendChild(ends);
    rng.addEventListener('input',function(){_minSize=Number(rng.value);fmt();_applyFilter();});
  }
  var rs=document.createElement('button');rs.type='button';rs.className='fp-reset';rs.textContent='Reset filter';
  rs.addEventListener('click',function(){_hiddenStatus={};_minSize=0;_renderChrome(_curScene);});
  fd.appendChild(rs);
  _show('tbFilterW',plots.length>0);
  var lm=_landmarks(s),nd=document.getElementById('npList');nd.innerHTML='';
  lm.forEach(function(h){
    var c=document.createElement('div');c.className='np-card';c.tabIndex=0;c.setAttribute('role','button');
    if(h.sublabel){var tm=document.createElement('div');tm.className='np-time';tm.textContent=h.sublabel;c.appendChild(tm);}
    var main=document.createElement('div');main.className='np-main';
    var top=document.createElement('div');top.className='np-top';
    var nm=document.createElement('div');nm.className='np-name';nm.textContent=h.label||'Landmark';top.appendChild(nm);
    if(h.routeUrl){
      var rt=document.createElement('button');rt.type='button';rt.className='np-route';rt.textContent='Route ↗';
      rt.addEventListener('click',function(e){e.stopPropagation();window.open(h.routeUrl,'_blank','noopener');});
      top.appendChild(rt);
    }
    main.appendChild(top);
    if(h.description){var ds=document.createElement('div');ds.className='np-desc';ds.textContent=h.description;main.appendChild(ds);}
    if(h.distanceText){var mt=document.createElement('div');mt.className='np-meta';mt.textContent=h.distanceText;main.appendChild(mt);}
    c.appendChild(main);
    c.addEventListener('click',function(){flyToLandmark(h);});
    c.addEventListener('keydown',function(e){if(e.key==='Enter')flyToLandmark(h);});
    nd.appendChild(c);
  });
  _show('tbNearbyW',lm.length>0);
  if(!lm.length)_setNearby(false);
  _activePlot=null;_applyFilter();
}

// Right rail.
function _zoomBy(d){_stopAuto();try{viewer.animate({zoom:Math.max(0,Math.min(100,viewer.getZoomLevel()+d)),speed:300});}catch(e){}}
document.getElementById('rbIn').addEventListener('click',function(){_zoomBy(12);});
document.getElementById('rbOut').addEventListener('click',function(){_zoomBy(-12);});
document.getElementById('rbTop').addEventListener('click',topView);
document.getElementById('rbLook').addEventListener('click',lookAround);
document.getElementById('rbFs').addEventListener('click',toggleFS);
document.getElementById('rbScenes').addEventListener('click',toggleSceneSidebar);
_show('rbScenes',SM.length>1);
// Motion control only on touch devices (phones/tablets have the sensors).
_show('rbMotion',('ontouchstart' in window)||navigator.maxTouchPoints>0);
document.getElementById('rbMotion').addEventListener('click',function(){
  var g;try{g=viewer.getPlugin('gyroscope');}catch(e){g=null;}
  if(!g)return;
  Promise.resolve(g.toggle()).then(function(){document.getElementById('rbMotion').classList.toggle('on',g.isEnabled());}).catch(function(){});
});

${introCode}

// Module-scope top-level functions are NOT global — the inline onclick="..."
// attributes on the control buttons need them on window explicitly.
function move(d){var s=10*Math.PI/180;var p=viewer.getPosition();if(d==='up')viewer.rotate({yaw:p.yaw,pitch:p.pitch+s});if(d==='dn')viewer.rotate({yaw:p.yaw,pitch:p.pitch-s});if(d==='lt')viewer.rotate({yaw:p.yaw-s,pitch:p.pitch});if(d==='rt')viewer.rotate({yaw:p.yaw+s,pitch:p.pitch});if(d==='zi')viewer.zoomIn(10);if(d==='zo')viewer.zoomOut(10);}
window.move=move;
function toggleFS(){if(!document.fullscreenElement){document.documentElement.requestFullscreen().catch(function(e){console.warn('Fullscreen request was blocked:',e&&e.message);});}else{document.exitFullscreen();}}
window.toggleFS=toggleFS;
var _sidebarHidden=true;
function toggleSceneSidebar(){
  _sidebarHidden=!_sidebarHidden;
  document.getElementById('sceneSidebar').classList.toggle('hidden',_sidebarHidden);
  document.getElementById('rbScenes').classList.toggle('on',!_sidebarHidden);
}
window.toggleSceneSidebar=toggleSceneSidebar;
document.addEventListener('fullscreenchange',function(){var fs=document.fullscreenElement,sb=document.getElementById('sceneSidebar'),sbt=document.getElementById('sbToggle'),ct=document.getElementById('controls'),lg=document.getElementById('wmLayer'),zcb=document.getElementById('zoneCardBackdrop'),zc=document.getElementById('zoneCard'),lb=document.getElementById('imgLightbox');if(fs){if(sb&&!fs.contains(sb))fs.appendChild(sb);if(sbt&&!fs.contains(sbt))fs.appendChild(sbt);if(ct&&!fs.contains(ct))fs.appendChild(ct);if(lg&&!fs.contains(lg))fs.appendChild(lg);if(zcb&&!fs.contains(zcb))fs.appendChild(zcb);if(zc&&!fs.contains(zc))fs.appendChild(zc);if(lb&&!fs.contains(lb))fs.appendChild(lb);}else{if(sb)document.body.appendChild(sb);if(sbt)document.body.appendChild(sbt);if(ct)document.body.appendChild(ct);if(lg)document.body.appendChild(lg);if(zcb)document.body.appendChild(zcb);if(zc)document.body.appendChild(zc);if(lb)document.body.appendChild(lb);}});
function _chk(){var l=window.innerWidth>window.innerHeight;document.getElementById('rotateOverlay').style.display=l?'none':'flex';}
window.addEventListener('orientationchange',function(){setTimeout(_chk,300);});window.addEventListener('resize',function(){setTimeout(_chk,300);});setTimeout(_chk,300);
</script></body></html>`
}
