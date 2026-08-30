// components/360editor/project/export_builder.js
// Builds the complete standalone tour HTML string.
// Used by the editor for both Preview (iframe) and Export (download).
// Pure JS — no React, no side effects.

import { ARROWS } from '@/lib/arrows'
import { projectLogos, projectCoverups, overlaysForScene } from '@/lib/overlays'
import { colorForStatus } from '@/lib/polygons'

const PSV_VERSION = '5.15.1'
const THREE_VERSION = '0.185.1'

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
                    gif: arrow.gif, label: h.label || '',
                    size: project.hotspot_size ?? 90,
                    target: h.target_scene_id,
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
                color: colorForStatus(z.status),
                status: z.status,
                label: z.label || '',
                detail: z.detail || {},
            }))

        tours[scene.id] = {
            name:  scene.name,
            panorama: scene.url,
            yaw:   scene.initial_yaw   ?? 0,
            pitch: scene.initial_pitch ?? -5,
            hfov:  scene.initial_hfov  ?? 120,
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
</style>
</head>
<body>
<div id="loadOverlay"><div id="loadTitle">${escapeHtml(project.name)}</div><div id="loadPct">Loading… 0%</div><div id="loadBar"><div id="loadFill"></div></div></div>
<div id="rotateOverlay"><svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.4"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 17h.01"/></svg><p>Please rotate your device<br>to landscape mode</p></div>
${introHtml}
<div id="viewer"></div>
${logoHtml}
<div id="zoneCard"><div class="zc-head"><span class="zc-dot" id="zcDot"></span><span class="zc-title" id="zcTitle"></span><button class="zc-close" onclick="hideZoneCard()">&#10005;</button></div><div class="zc-status" id="zcStatus"></div><div id="zcDetail"></div></div>
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

function arrowMarker(h){return {id:'hs_'+h.id,type:'image',image:h.gif,size:{width:h.size,height:h.size},position:{yaw:h.yaw+'deg',pitch:h.pitch+'deg'},tooltip:h.label||undefined,data:{target:h.target}};}
function coverMarker(c,baseHfov){return {id:'cv_'+c.id,type:'image',image:c.url,size:{width:c.size,height:c.size},position:{yaw:c.yaw+'deg',pitch:c.pitch+'deg'},opacity:c.opacity,rotation:c.rotation+'deg',scale:function(zl){try{return baseHfov/viewer.dataHelper.zoomLevelToFov(zl);}catch(e){return 1;}}};}
function zoneMarker(z){return {id:'poly_'+z.id,type:'polygon',polygon:z.points.map(function(pt){return [pt[0]+'deg',pt[1]+'deg'];}),svgStyle:{fill:z.color+'55',stroke:z.color,strokeWidth:'2'},data:z};}
function markersFor(id){var s=TOURS[id];return s.covers.map(function(c){return coverMarker(c,s.hfov);}).concat(s.zones.map(zoneMarker)).concat(s.arrows.map(arrowMarker));}

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
  viewer.setPanorama(s.panorama,{transition:false}).then(function(){
    viewer.rotate({yaw:s.yaw+'deg',pitch:s.pitch+'deg'});
    try{viewer.zoom(viewer.dataHelper.fovToZoomLevel(s.hfov));}catch(e){}
    mp.setMarkers(markersFor(id));
    _onScene(id);
  });
}
mp.addEventListener('select-marker',function(ev){
  var m=ev.marker;
  if(m.id.indexOf('hs_')===0 && m.data && m.data.target) loadScene(m.data.target);
  if(m.id.indexOf('poly_')===0) showZoneCard(m.data);
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
function _onScene(id){_hl(id);_wm(id);hideZoneCard();}
${introCode}

// Module-scope top-level functions are NOT global — the inline onclick="..."
// attributes on the control buttons need them on window explicitly.
function move(d){var s=10*Math.PI/180;var p=viewer.getPosition();if(d==='up')viewer.rotate({yaw:p.yaw,pitch:p.pitch+s});if(d==='dn')viewer.rotate({yaw:p.yaw,pitch:p.pitch-s});if(d==='lt')viewer.rotate({yaw:p.yaw-s,pitch:p.pitch});if(d==='rt')viewer.rotate({yaw:p.yaw+s,pitch:p.pitch});if(d==='zi')viewer.zoomIn(10);if(d==='zo')viewer.zoomOut(10);}
window.move=move;
function toggleFS(){if(!document.fullscreenElement){document.documentElement.requestFullscreen().catch(function(){});}else{document.exitFullscreen();}}
window.toggleFS=toggleFS;
document.addEventListener('fullscreenchange',function(){var fs=document.fullscreenElement,sb=document.getElementById('sceneSidebar'),ct=document.getElementById('controls'),lg=document.getElementById('wmLayer'),zc=document.getElementById('zoneCard');if(fs){if(sb&&!fs.contains(sb))fs.appendChild(sb);if(ct&&!fs.contains(ct))fs.appendChild(ct);if(lg&&!fs.contains(lg))fs.appendChild(lg);if(zc&&!fs.contains(zc))fs.appendChild(zc);}else{if(sb)document.body.appendChild(sb);if(ct)document.body.appendChild(ct);if(lg)document.body.appendChild(lg);if(zc)document.body.appendChild(zc);}});
function _chk(){var l=window.innerWidth>window.innerHeight;document.getElementById('rotateOverlay').style.display=l?'none':'flex';}
window.addEventListener('orientationchange',function(){setTimeout(_chk,300);});window.addEventListener('resize',function(){setTimeout(_chk,300);});setTimeout(_chk,300);
</script></body></html>`
}
