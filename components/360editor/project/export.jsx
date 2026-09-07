// components/360editor/project/export_builder.js
// Builds the complete standalone tour HTML string.
// Used by the editor for both Preview (iframe) and Export (download).
// Pure JS — no React, no side effects.

import { ARROWS } from '@/lib/arrows'
import { projectLogos, projectCoverups, overlaysForScene } from '@/lib/overlays'
import { colorForStatus } from '@/lib/polygons'
import { DEFAULT_HOTSPOT_COLOR, DEFAULT_LABEL_COLOR } from '@/lib/hotspots'

const PSV_VERSION = '5.15.1'
const THREE_VERSION = '0.185.1'

// Fallback opening horizontal FOV — must match middle.jsx's DEFAULT_HFOV so a
// published tour's opening view matches what the editor showed. Lower = more
// zoomed in; 70deg reads as a closer, more immersive opening view than the
// old 90deg default without going so narrow it hides the room's edges.
const DEFAULT_HFOV = 70

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
        const arrows = hotspots
            .filter(h => h.scene_id === scene.id)
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
        const sceneZones = zones
            .filter(z => z.scene_id === scene.id)
            .map(z => ({
                id: z.id,
                points: z.points,
                color: colorForStatus(z.status, z.custom_color),
                status: z.status,
                label: z.label || '',
                detail: z.detail || {},
                edgeLengths: z.edge_lengths || [],
                actionType: z.action_type || 'info',
                target: z.target_scene_id,
                linkUrl: z.link_url || '',
                infoBody: z.info_body || '',
                infoImageUrl: z.info_image_url || '',
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
#sceneSidebar{position:fixed;top:50%;right:18px;transform:translateY(-50%);z-index:20000;max-height:90vh;overflow-y:auto;-ms-overflow-style:none;scrollbar-width:none;display:flex;flex-direction:column;gap:10px;padding:4px 0;}
#sceneSidebar::-webkit-scrollbar{display:none}
.ss-item{cursor:pointer;text-align:center;transition:transform .25s ease}.ss-item:hover{transform:scale(1.06)}
.ss-item img{width:115px;height:72px;object-fit:cover;border-radius:10px;display:block;box-shadow:0 3px 14px rgba(0,0,0,.55);border:2px solid transparent;transition:border-color .2s ease;}
.ss-item.active img{border-color:#3730a3}
.ss-item span{display:block;margin-top:5px;font-size:12px;color:#fff;font-weight:600;text-shadow:0 1px 4px rgba(0,0,0,.75);}
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
#zoneCard{position:fixed;left:18px;bottom:64px;z-index:25000;display:none;width:220px;background:rgba(20,20,26,.92);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:14px 16px;color:#fff;box-shadow:0 12px 36px rgba(0,0,0,.45);}
#zoneCard .zc-head{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
#zoneCard .zc-dot{width:9px;height:9px;border-radius:50%;flex:none;}
#zoneCard .zc-title{font-size:14px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
#zoneCard .zc-close{cursor:pointer;opacity:.6;flex:none;font-size:14px;line-height:1;background:none;border:none;color:#fff;}
#zoneCard .zc-close:hover{opacity:1}
#zoneCard .zc-status{font-size:11px;opacity:.7;text-transform:capitalize;margin-bottom:8px;}
#zoneCard .zc-row{display:flex;justify-content:space-between;gap:10px;font-size:12px;padding:3px 0;}
#zoneCard .zc-row span:first-child{opacity:.55}
#zoneCard .zc-row span:last-child{font-weight:600;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
#zoneCard .zc-image{width:100%;border-radius:8px;margin:8px 0;object-fit:cover;max-height:140px;}
#zoneCard .zc-body{font-size:12px;line-height:1.5;opacity:.85;margin:8px 0 0;white-space:pre-wrap;}
#zoneCard .zc-link{margin-top:10px;background:#3730a3;color:#fff;font-size:11px;font-weight:600;text-decoration:none;padding:7px 14px;border-radius:16px;text-align:center;}
.edge-label{pointer-events:none;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);color:#fff;font-size:10px;font-weight:600;padding:3px 8px;border-radius:20px;white-space:nowrap;}
.hs-info{padding:2px 2px 8px}
.hs-info h3{font-size:15px;font-weight:600;margin:0 0 8px}
.hs-info img{display:block;width:100%;border-radius:10px;margin-bottom:10px;object-fit:cover;max-height:180px;}
.hs-info p{font-size:13px;line-height:1.5;opacity:.85;margin:0 0 12px;white-space:pre-wrap;}
.hs-info a{display:inline-block;background:#3730a3;color:#fff;font-size:12px;font-weight:600;text-decoration:none;padding:8px 16px;border-radius:20px;}
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
<div id="zoneCard"><div class="zc-head"><span class="zc-dot" id="zcDot"></span><span class="zc-title" id="zcTitle"></span><button class="zc-close" onclick="hideZoneCard()">&#10005;</button></div><div class="zc-status" id="zcStatus"></div><img class="zc-image" id="zcImage" alt=""><div id="zcDetail"></div><p class="zc-body" id="zcBody"></p><a class="zc-link" id="zcLink" target="_blank" rel="noopener">Learn more</a></div>
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
  if(h.infoImageUrl) html+='<img src="'+esc(h.infoImageUrl)+'" alt="">';
  if(h.infoBody) html+='<p>'+esc(h.infoBody)+'</p>';
  if(h.linkUrl) html+='<a href="'+esc(h.linkUrl)+'" target="_blank" rel="noopener">Learn more</a>';
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
  var d={target:h.target,actionType:h.actionType,linkUrl:h.linkUrl,toggleTargetId:h.toggleTargetId};
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
  // Pulse ring stays a plain billboard (a true 3D marker would freeze its
  // pulse animation to one static frame) but X/Y still get a real visible
  // effect via a CSS transform on the marker element -- the transform
  // property (unlike rotate/translate, which PSV's own 2D markers already
  // use for Z-rotation/position) is never touched by PSV's marker code for
  // this type, so it's free for a cosmetic perspective tilt. Mirrors
  // middle.jsx's arrowMarkers builder exactly.
  if(h.type==='pulse'){return Object.assign({id:'hs_'+h.id,type:'image',image:h.gif,size:{width:h.size,height:h.size},position:{yaw:h.yaw+'deg',pitch:h.pitch+'deg'},rotation:(h.rotation||0)+'deg',tooltip:h.label||undefined,style:{transform:'perspective(600px) rotateX('+h.rotateX+'deg) rotateY('+h.rotateY+'deg)'},data:d},extra);}
  return Object.assign({id:'hs_'+h.id,type:'image',image:h.gif,size:{width:h.size,height:h.size},position:{yaw:h.yaw+'deg',pitch:h.pitch+'deg'},rotation:(h.rotation||0)+'deg',tooltip:h.label||undefined,data:d},extra);
}
function coverMarker(c,baseHfov){return {id:'cv_'+c.id,type:'image',image:c.url,size:{width:c.size,height:c.size},position:{yaw:c.yaw+'deg',pitch:c.pitch+'deg'},opacity:c.opacity,rotation:c.rotation+'deg',scale:function(zl){try{return baseHfov/viewer.dataHelper.zoomLevelToFov(zl);}catch(e){return 1;}}};}
function zoneMarker(z){return {id:'poly_'+z.id,type:'polygon',polygon:z.points.map(function(pt){return [pt[0]+'deg',pt[1]+'deg'];}),svgStyle:{fill:z.color+'55',stroke:z.color,strokeWidth:'2'},visible:!z.startHidden,data:z};}
// One read-only label per edge that actually has a length typed in (edge i
// runs from points[i] to points[(i+1) % length]) -- a plain arithmetic
// midpoint, same tolerance lib/polygons.js's own centroidOf() uses for these
// compact, single-object-sized shapes. Non-interactive (pointer-events:none
// in CSS) so it never steals the zone's own click.
function edgeLabelMarkers(z){
  var out=[],lens=z.edgeLengths||[];
  for(var i=0;i<z.points.length;i++){
    var label=lens[i];
    if(!label)continue;
    var a=z.points[i],b=z.points[(i+1)%z.points.length];
    out.push({id:'elabel_'+z.id+'_'+i,type:'html',html:'<div class="edge-label">'+esc(label)+'</div>',anchor:'center center',position:{yaw:((a[0]+b[0])/2)+'deg',pitch:((a[1]+b[1])/2)+'deg'},visible:!z.startHidden});
  }
  return out;
}
function markersFor(id){
  var s=TOURS[id];
  var out=s.covers.map(function(c){return coverMarker(c,s.hfov);}).concat(s.zones.map(zoneMarker)).concat(s.arrows.map(arrowMarker));
  s.zones.forEach(function(z){out=out.concat(edgeLabelMarkers(z));});
  return out;
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
mp.addEventListener('select-marker',function(ev){
  var m=ev.marker;
  if(m.id.indexOf('hs_')===0 && m.data){
    var d=m.data,t=d.actionType||'navigate';
    // 'info' needs nothing here -- PSV's own showMarkerPanel() already
    // opened the content panel (set via arrowMarker's config.content)
    // before this listener even runs.
    if(t==='navigate' && d.target) loadScene(d.target);
    else if(t==='link') openLink(d.linkUrl);
    // toggleMarker is a built-in MarkersPlugin method -- no manual
    // visible-state tracking needed.
    else if(t==='toggle' && d.toggleTargetId) mp.toggleMarker('hs_'+d.toggleTargetId);
  }
  if(m.id.indexOf('poly_')===0 && m.data){
    var z=m.data,zt=z.actionType||'info';
    if(zt==='navigate' && z.target) loadScene(z.target);
    else if(zt==='link') openLink(z.linkUrl);
    else if(zt==='toggle' && z.toggleTargetId) mp.toggleMarker('hs_'+z.toggleTargetId);
    else showZoneCard(z);
  }
});
mp.addEventListener('enter-marker',function(ev){
  var m=ev.marker;
  if(m.id.indexOf('poly_')!==0||!m.data)return;
  mp.updateMarker({id:m.id,svgStyle:{fill:m.data.color+'99',stroke:m.data.color,strokeWidth:'3'}});
});
mp.addEventListener('leave-marker',function(ev){
  var m=ev.marker;
  if(m.id.indexOf('poly_')!==0||!m.data)return;
  mp.updateMarker({id:m.id,svgStyle:{fill:m.data.color+'55',stroke:m.data.color,strokeWidth:'2'}});
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
// Fraction of the viewport inset on every side before a landmark counts as
// "in view" -- 0 would trigger the instant it touches the literal edge
// (the old behavior); 0.25 means it has to clear a quarter of the screen's
// width/height inward first, so the animation reads as reacting to the
// landmark coming properly into frame, not just barely peeking into it.
// The SAME boundary is used both ways (no separate enter/exit thresholds).
var _INVIEW_MARGIN=0.25;
function _updateLandmarkAnim(){
  var s=_curScene&&TOURS[_curScene];
  if(!s)return;
  var host=document.getElementById('viewer');
  var vw=host?host.clientWidth:window.innerWidth, vh=host?host.clientHeight:window.innerHeight;
  var mx=vw*_INVIEW_MARGIN, my=vh*_INVIEW_MARGIN;
  s.arrows.forEach(function(h){
    if(h.type!=='landmark'||!h.animateLine)return;
    var marker;
    try{marker=mp.getMarker('hs_'+h.id);}catch(e){marker=null;}
    var el=marker&&marker.domElement&&marker.domElement.querySelector('.lm');
    if(!el)return;
    var inView=false;
    try{
      var pt=viewer.dataHelper.sphericalCoordsToViewerCoords({yaw:h.yaw*Math.PI/180,pitch:h.pitch*Math.PI/180});
      inView=!!pt&&pt.x>=mx&&pt.x<=vw-mx&&pt.y>=my&&pt.y<=vh-my;
    }catch(e){}
    el.classList.toggle('lm-in-view',inView);
  });
}
viewer.addEventListener('position-updated',_updateLandmarkAnim);
viewer.addEventListener('zoom-updated',_updateLandmarkAnim);
function hideZoneCard(){document.getElementById('zoneCard').style.display='none';}
window.hideZoneCard=hideZoneCard;
function showZoneCard(z){
  document.getElementById('zcDot').style.background=z.color;
  document.getElementById('zcTitle').textContent=z.label||'Zone';
  document.getElementById('zcStatus').textContent=z.status;
  var body=document.getElementById('zcDetail');
  body.innerHTML='';
  Object.keys(z.detail||{}).forEach(function(k){
    var row=document.createElement('div');row.className='zc-row';
    var a=document.createElement('span');a.textContent=k;
    var b=document.createElement('span');b.textContent=String(z.detail[k]);
    row.appendChild(a);row.appendChild(b);body.appendChild(row);
  });
  // Optional extras shared with the hotspot info card (same action-system
  // fields) -- absent on every zone that predates this, so each one only
  // shows up when actually set.
  var img=document.getElementById('zcImage');
  if(z.infoImageUrl){img.src=z.infoImageUrl;img.style.display='block';}else{img.style.display='none';}
  var bodyText=document.getElementById('zcBody');
  if(z.infoBody){bodyText.textContent=z.infoBody;bodyText.style.display='block';}else{bodyText.style.display='none';}
  var link=document.getElementById('zcLink');
  if(z.linkUrl){link.href=z.linkUrl;link.style.display='block';}else{link.style.display='none';}
  document.getElementById('zoneCard').style.display='block';
}

SM.forEach(function(s){var d=document.createElement('div');d.className='ss-item';d.dataset.id=s.id;var img=document.createElement('img');img.src=s.url;img.alt=s.name;var lbl=document.createElement('span');lbl.textContent=s.name;d.appendChild(img);d.appendChild(lbl);d.addEventListener('click',function(){loadScene(s.id);});document.getElementById('sceneSidebar').appendChild(d);});
function _hl(id){document.querySelectorAll('.ss-item').forEach(function(el){el.classList.toggle('active',el.dataset.id===id);});}
var LOGOS=${logoData};
function _clampWM(el,l){var host=document.getElementById('viewer')||document.body;var vw=host.clientWidth||1,vh=host.clientHeight||1;var bw=el.offsetWidth||l.w,bh=el.offsetHeight||l.w;var hx=(bw/2/vw)*100,hy=(bh/2/vh)*100;var x=hx*2>=100?50:Math.min(100-hx,Math.max(hx,l.x));var y=hy*2>=100?50:Math.min(100-hy,Math.max(hy,l.y));el.style.left=x+'%';el.style.top=y+'%';}
var _WMCUR=[];
function _wm(id){var layer=document.getElementById('wmLayer');if(!layer)return;layer.innerHTML='';_WMCUR=[];LOGOS.forEach(function(l){if(l.s!=null&&l.s!==id)return;var d=document.createElement('div');d.className='wm';d.style.cssText='left:'+l.x+'%;top:'+l.y+'%;width:'+l.w+'px;opacity:'+l.o+';';var img=document.createElement('img');img.src=l.u;img.alt='';img.onload=function(){_clampWM(d,l);};d.appendChild(img);layer.appendChild(d);_WMCUR.push({el:d,l:l});_clampWM(d,l);});}
function _reclampWM(){_WMCUR.forEach(function(o){_clampWM(o.el,o.l);});}
window.addEventListener('resize',_reclampWM);
function _onScene(id){_curScene=id;_hl(id);_wm(id);hideZoneCard();_updateLandmarkAnim();}
${introCode}

// Module-scope top-level functions are NOT global — the inline onclick="..."
// attributes on the control buttons need them on window explicitly.
function move(d){var s=10*Math.PI/180;var p=viewer.getPosition();if(d==='up')viewer.rotate({yaw:p.yaw,pitch:p.pitch+s});if(d==='dn')viewer.rotate({yaw:p.yaw,pitch:p.pitch-s});if(d==='lt')viewer.rotate({yaw:p.yaw-s,pitch:p.pitch});if(d==='rt')viewer.rotate({yaw:p.yaw+s,pitch:p.pitch});if(d==='zi')viewer.zoomIn(10);if(d==='zo')viewer.zoomOut(10);}
window.move=move;
function toggleFS(){if(!document.fullscreenElement){document.documentElement.requestFullscreen().catch(function(e){console.warn('Fullscreen request was blocked:',e&&e.message);});}else{document.exitFullscreen();}}
window.toggleFS=toggleFS;
document.addEventListener('fullscreenchange',function(){var fs=document.fullscreenElement,sb=document.getElementById('sceneSidebar'),ct=document.getElementById('controls'),lg=document.getElementById('wmLayer'),zc=document.getElementById('zoneCard');if(fs){if(sb&&!fs.contains(sb))fs.appendChild(sb);if(ct&&!fs.contains(ct))fs.appendChild(ct);if(lg&&!fs.contains(lg))fs.appendChild(lg);if(zc&&!fs.contains(zc))fs.appendChild(zc);}else{if(sb)document.body.appendChild(sb);if(ct)document.body.appendChild(ct);if(lg)document.body.appendChild(lg);if(zc)document.body.appendChild(zc);}});
function _chk(){var l=window.innerWidth>window.innerHeight;document.getElementById('rotateOverlay').style.display=l?'none':'flex';}
window.addEventListener('orientationchange',function(){setTimeout(_chk,300);});window.addEventListener('resize',function(){setTimeout(_chk,300);});setTimeout(_chk,300);
</script></body></html>`
}
