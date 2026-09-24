// components/360editor/project/export_builder.js
// Builds the complete standalone tour HTML string.
// Used by the editor for both Preview (iframe) and Export (download).
// Pure JS — no React, no side effects.

import { ARROWS } from '@/lib/arrows'
import { projectLogos, projectCoverups, overlaysForScene } from '@/lib/overlays'
import { colorForStatus, borderColorFor, hoverColorFor, badgeLabelStyleFor } from '@/lib/polygons'
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
            arrows, covers, zones: sceneZones,
        }
        sceneList.push({ id: scene.id, name: scene.name, url: scene.url })
    }

    const toursJson     = safeJson(tours)
    const sceneListJson = safeJson(sceneList)

    // Logo watermarks — fixed screen overlays, NOT sphere markers. Because a
    // logo can now be scoped to one scene, the set is rebuilt on every
    // scenechange from data rather than baked once. The layer element is always
    // present (fullscreen moves it); its contents are swapped by _wm() below.
    const logoData = safeJson(allLogos.map(l => ({
        u: l.url, s: l.scene_id, x: l.x, y: l.y, w: l.size, o: l.opacity,
    })))
    const logoHtml = `<div id="wmLayer"></div>`

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
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;font-family:'Poppins',-apple-system,sans-serif;background:#000}
#viewer{width:100vw;height:100vh}
.wm{position:fixed;transform:translate(-50%,-50%);z-index:15000;pointer-events:none;max-width:90vw;}
.wm img{display:block;width:100%;height:auto;filter:drop-shadow(0 2px 8px rgba(0,0,0,.5));}
#sceneSidebar{position:fixed;top:50%;right:8px;transform:translateY(-50%);z-index:20000;max-height:80vh;overflow-y:auto;-ms-overflow-style:none;scrollbar-width:none;display:flex;flex-direction:column;gap:7px;padding:6px 8px;opacity:1;transition:opacity .28s ease,transform .28s ease;}
#sceneSidebar::-webkit-scrollbar{display:none}
#sceneSidebar.hidden{opacity:0;transform:translateY(-50%) translateX(10px);pointer-events:none;}
/* Neutral dark glass -- NOT saturate()'d, which was pulling in whatever warm
   tone the panorama behind it happened to be (that's what read as "orange"). */
#sbToggle{position:fixed;top:18px;right:8px;z-index:20001;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.22);cursor:pointer;background:rgba(15,15,18,.4);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 18px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.18);transition:background .2s ease,transform .2s ease;}
#sbToggle:hover{background:rgba(15,15,18,.58);transform:scale(1.07)}
#sbToggle:active{transform:scale(.94)}
/* Fixed to the image's own width so a long scene name never widens the
   item past it -- the name is what gets trimmed (ellipsis), never the
   image's flush position against the right edge. */
.ss-item{cursor:pointer;text-align:center;transition:transform .25s ease;width:78px;}.ss-item:hover{transform:scale(1.06)}
.ss-item img{width:78px;height:49px;object-fit:cover;border-radius:8px;display:block;box-shadow:0 2px 10px rgba(0,0,0,.5);border:2px solid transparent;transition:border-color .2s ease;}
.ss-item.active img{border-color:#3730a3}
.ss-item span{display:block;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px;font-size:10px;color:#fff;font-weight:600;text-shadow:0 1px 4px rgba(0,0,0,.75);}
#controls{position:fixed;bottom:10px;left:50%;transform:translateX(-50%);z-index:20000;display:flex;gap:5px;}
.ctrl{width:38px;height:38px;border-radius:9px;border:none;cursor:pointer;font-size:15px;font-weight:700;background:rgba(255,255,255,.88);backdrop-filter:blur(8px);color:#1a1a18;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.28);transition:background .15s ease;}.ctrl:hover{background:#fff}
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
.zone-label{pointer-events:none;background:rgba(255,255,255,.92);color:#14141a;font-size:12px;font-weight:700;line-height:1;padding:4px 9px;border-radius:20px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.4);}
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
.lm{position:relative;display:flex;flex-direction:column;align-items:center;pointer-events:auto;filter:drop-shadow(0 0 1.5px rgba(0,0,0,.75)) drop-shadow(0 2px 4px rgba(0,0,0,.4));}
.lm-label{background:var(--lm-label-color,#14141a);color:#fff;font-size:12px;font-weight:600;padding:4px 10px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.35);margin-bottom:4px;border-bottom:2px solid var(--lm-color,#3730a3);}
.lm-line{width:3.5px;height:var(--lm-height,48px);background:var(--lm-color,#3730a3);border-radius:2px;}
.lm-dot{width:15px;height:15px;border-radius:50%;background:var(--lm-color,#3730a3);border:2px solid #fff;box-shadow:0 0 0 0 var(--lm-color,#3730a3);animation:lm-pulse 2s ease-out infinite;}
@keyframes lm-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb, var(--lm-color,#3730a3) 55%, transparent)}70%{box-shadow:0 0 0 14px color-mix(in srgb, var(--lm-color,#3730a3) 0%, transparent)}100%{box-shadow:0 0 0 0 color-mix(in srgb, var(--lm-color,#3730a3) 0%, transparent)}}
.lm.lm-anim .lm-line{transform:scaleY(0);transform-origin:bottom center;transition:transform 1.1s cubic-bezier(.22,1,.36,1);}
.lm.lm-anim .lm-label{opacity:0;transition:opacity .3s ease;}
.lm.lm-anim.lm-in-view .lm-line{transform:scaleY(1);}
.lm.lm-anim.lm-in-view .lm-label{opacity:1;transition:opacity .3s ease 1.1s;}
</style>
</head>
<body>
<div id="loadOverlay"><div id="loadTitle">${escapeHtml(project.name)}</div><div id="loadPct">Loading… 0%</div><div id="loadBar"><div id="loadFill"></div></div></div>
<div id="rotateOverlay"><svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.4"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 17h.01"/></svg><p>Please rotate your device<br>to landscape mode</p></div>
${introHtml}
<div id="viewer"></div>
${logoHtml}
<div id="zoneCardBackdrop"></div><div id="zoneCard"><button class="zc-close" aria-label="Close" onclick="hideZoneCard()">&#10005;</button><div id="zcImages"></div><div id="zcDetail"></div></div>
<div id="imgLightbox"><div id="imgLbFrame"><img id="imgLbImg" alt=""><button id="imgLbClose" aria-label="Close">&#10005;</button></div></div>
<button id="sbToggle" onclick="toggleSceneSidebar()" title="Hide scene list" aria-label="Hide scene list">
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
</button>
<div id="sceneSidebar"></div>
<div id="controls">
  <button class="ctrl" onclick="move('up')">▲</button><button class="ctrl" onclick="move('dn')">▼</button>
  <button class="ctrl" onclick="move('lt')">◀</button><button class="ctrl" onclick="move('rt')">▶</button>
  <button class="ctrl" onclick="move('zi')">+</button><button class="ctrl" onclick="move('zo')">−</button>
  <button class="ctrl" onclick="toggleFS()">⛶</button>
</div>
<script type="importmap">
{"imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js",
  "@photo-sphere-viewer/core": "https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/core@${PSV_VERSION}/index.module.min.js"
}}
</script>
<script type="module">
import { Viewer } from 'https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/core@${PSV_VERSION}/index.module.min.js';
import { MarkersPlugin } from 'https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/markers-plugin@${PSV_VERSION}/index.module.min.js';
${autorotateImport}

var TOURS=${toursJson};var SM=${sceneListJson};

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
// height/color are baked into an inline style attribute on the markup
// itself, not left to PSV's own marker style config -- that config gets
// applied via Object.assign(element.style, config.style) (a plain
// property assignment, not style.setProperty()), which doesn't reliably
// set CSS custom properties. An inline style="..." attribute, parsed by
// the browser while setting innerHTML, doesn't go through that code path.
function landmarkHtml(label,height,color,labelColor,animate){
  var h=(typeof height==='number'&&isFinite(height))?height:48;
  var c=/^#[0-9a-f]{6}$/i.test(color||'')?color:'#3730a3';
  var lc=/^#[0-9a-f]{6}$/i.test(labelColor||'')?labelColor:'#14141a';
  // lm-anim starts the line collapsed (see the .lm.lm-anim CSS rules) --
  // _updateLandmarkAnim adds lm-in-view the moment the camera pans this
  // landmark into the visible frame, which is what actually grows it.
  return '<div class="lm'+(animate?' lm-anim':'')+'" style="--lm-height:'+h+'px;--lm-color:'+c+';--lm-label-color:'+lc+'"><div class="lm-label">'+esc(label||'Landmark')+'</div><div class="lm-line"></div><div class="lm-dot"></div></div>';
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
  var d={target:h.target,actionType:h.actionType,linkUrl:h.linkUrl,toggleTargetId:h.toggleTargetId,infoImageUrl:h.infoImageUrl};
  if(h.type==='landmark'){return Object.assign({id:'hs_'+h.id,type:'html',html:landmarkHtml(h.label,h.size,h.color,h.labelColor,h.animateLine),anchor:'bottom center',position:{yaw:h.yaw+'deg',pitch:h.pitch+'deg'},data:d},extra);}
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
function zoneMarker(z){return {id:'poly_'+z.id,type:'polygon',polygon:z.points.map(function(pt){return [pt[0]+'deg',pt[1]+'deg'];}),svgStyle:{fill:z.color+_alphaHex(z.fillOpacity),stroke:z.borderColor||z.color,strokeWidth:'2'},visible:!z.startHidden,data:z};}
// The zone's own label as an always-visible badge at its centre -- the
// plot-number pill a site plan lives on. Plain arithmetic centroid, same
// simplification lib/polygons.js's centroidOf() documents (not seam-aware),
// fine for the compact shapes this is for. Non-interactive (pointer-events
// :none in CSS) so it never steals the zone's own click.
function zoneLabelMarker(z){
  if(!z.showLabel||!z.label)return null;
  var n=z.points.length;if(!n)return null;
  var cy=0,cp=0;for(var i=0;i<n;i++){cy+=z.points[i][0];cp+=z.points[i][1];}cy/=n;cp/=n;
  var st=z.labelStyle?' style="'+z.labelStyle+'"':'';
  return {id:'zlabel_'+z.id,type:'html',html:'<div class="zone-label"'+st+'>'+esc(z.label)+'</div>',anchor:'center center',position:{yaw:cy+'deg',pitch:cp+'deg'},visible:!z.startHidden,style:{pointerEvents:'none'}};
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
  return out.concat(s.arrows.map(arrowMarker));
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
  plugins:[[MarkersPlugin,{}]${autorotatePluginEntry}],
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
    if(t==='navigate' && d.target) loadScene(d.target);
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
var _LABEL_BADGE_H=22,_zlVis={};
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
  return (maxX-minX)>=(((z.label||'').length||1)*7.2+20)&&(maxY-minY)>=_LABEL_BADGE_H;
}
function _updateZoneLabels(){
  var s=_curScene&&TOURS[_curScene];
  if(!s)return;
  s.zones.forEach(function(z){
    if(!z.showLabel||!z.label)return;
    var fits=_zoneFitsLabel(z);
    if(_zlVis[z.id]===fits)return;
    _zlVis[z.id]=fits;
    try{mp.updateMarker({id:'zlabel_'+z.id,visible:fits&&!z.startHidden});}catch(e){}
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
function _updateEdgeLabels(){
  var s=_curScene&&TOURS[_curScene];
  if(!s)return;
  _edgeLabelSlots(s).forEach(function(slot){
    var el=_elEls[slot.z.id+'_'+slot.i];
    if(!el)return;
    if(slot.z.startHidden){el.style.display='none';return;}
    var a=slot.z.points[slot.i],b=slot.z.points[(slot.i+1)%slot.z.points.length];
    var pa=null,pb=null;
    try{
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
function _onScene(id){_curScene=id;_hl(id);_wm(id);hideZoneCard();_updateLandmarkAnim();_zlVis={};_updateZoneLabels();_rebuildEdgeLabels();}
${introCode}

// Module-scope top-level functions are NOT global — the inline onclick="..."
// attributes on the control buttons need them on window explicitly.
function move(d){var s=10*Math.PI/180;var p=viewer.getPosition();if(d==='up')viewer.rotate({yaw:p.yaw,pitch:p.pitch+s});if(d==='dn')viewer.rotate({yaw:p.yaw,pitch:p.pitch-s});if(d==='lt')viewer.rotate({yaw:p.yaw-s,pitch:p.pitch});if(d==='rt')viewer.rotate({yaw:p.yaw+s,pitch:p.pitch});if(d==='zi')viewer.zoomIn(10);if(d==='zo')viewer.zoomOut(10);}
window.move=move;
function toggleFS(){if(!document.fullscreenElement){document.documentElement.requestFullscreen().catch(function(e){console.warn('Fullscreen request was blocked:',e&&e.message);});}else{document.exitFullscreen();}}
window.toggleFS=toggleFS;
// Eye / eye-off -- swapped in place rather than kept as two separate nodes,
// so the single button's own icon always matches what a click does next.
var _EYE='<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
var _EYE_OFF='<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
var _sidebarHidden=false;
function toggleSceneSidebar(){
  _sidebarHidden=!_sidebarHidden;
  var sb=document.getElementById('sceneSidebar'),btn=document.getElementById('sbToggle');
  sb.classList.toggle('hidden',_sidebarHidden);
  btn.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">'+(_sidebarHidden?_EYE_OFF:_EYE)+'</svg>';
  var label=_sidebarHidden?'Show scene list':'Hide scene list';
  btn.title=label;btn.setAttribute('aria-label',label);
}
window.toggleSceneSidebar=toggleSceneSidebar;
document.addEventListener('fullscreenchange',function(){var fs=document.fullscreenElement,sb=document.getElementById('sceneSidebar'),sbt=document.getElementById('sbToggle'),ct=document.getElementById('controls'),lg=document.getElementById('wmLayer'),zcb=document.getElementById('zoneCardBackdrop'),zc=document.getElementById('zoneCard'),lb=document.getElementById('imgLightbox');if(fs){if(sb&&!fs.contains(sb))fs.appendChild(sb);if(sbt&&!fs.contains(sbt))fs.appendChild(sbt);if(ct&&!fs.contains(ct))fs.appendChild(ct);if(lg&&!fs.contains(lg))fs.appendChild(lg);if(zcb&&!fs.contains(zcb))fs.appendChild(zcb);if(zc&&!fs.contains(zc))fs.appendChild(zc);if(lb&&!fs.contains(lb))fs.appendChild(lb);}else{if(sb)document.body.appendChild(sb);if(sbt)document.body.appendChild(sbt);if(ct)document.body.appendChild(ct);if(lg)document.body.appendChild(lg);if(zcb)document.body.appendChild(zcb);if(zc)document.body.appendChild(zc);if(lb)document.body.appendChild(lb);}});
function _chk(){var l=window.innerWidth>window.innerHeight;document.getElementById('rotateOverlay').style.display=l?'none':'flex';}
window.addEventListener('orientationchange',function(){setTimeout(_chk,300);});window.addEventListener('resize',function(){setTimeout(_chk,300);});setTimeout(_chk,300);
</script></body></html>`
}
