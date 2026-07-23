// components/360editor/project/export_builder.js
// Builds the complete standalone tour HTML string.
// Used by the editor for both Preview (iframe) and Export (download).
// Pure JS — no React, no side effects.

import { ARROWS } from '@/lib/arrows'

export function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

export function buildTourHtml({ project, scenes, hotspots }) {
    const autoRotate = project.auto_rotate ?? -3
    const showIntro  = project.show_intro  ?? true
    const logoUrl    = project.logo_url    || ''
    const logoX      = project.logo_x      ?? 50
    const logoY      = project.logo_y      ?? 50
    const logoSize   = project.logo_size   ?? 160

    const pannellumScenes = {}
    const sceneList = []

    for (const scene of scenes) {
        const sceneHotspots = hotspots
            .filter(h => h.scene_id === scene.id)
            .map(h => {
                const arrow = ARROWS.find(a => a.type === h.arrow_type)
                return {
                    pitch: h.pitch, yaw: h.yaw, type: 'custom', text: h.label || '',
                    id: `hs_${h.id}`, createTooltipFuncName: 'makeHotspotTooltip',
                    createTooltipArgs: {
                        gif:           arrow?.gif || ARROWS[0].gif,
                        targetSceneId: h.target_scene_id,
                        label:         h.label || '',
                        size:          project.hotspot_size ?? 90,
                    },
                }
            })

        pannellumScenes[scene.id] = {
            title:    scene.name,
            panorama: scene.url,
            yaw:      scene.initial_yaw   ?? 0,
            pitch:    scene.initial_pitch ?? -5,
            hfov:     scene.initial_hfov  ?? 120,
            preload:  true,
            hotSpots: sceneHotspots,
        }
        sceneList.push({ id: scene.id, name: scene.name, url: scene.url })
    }

    const configJson    = JSON.stringify({
        default: { firstScene: scenes[0].id, sceneFadeDuration: 1000, autoLoad: true, showControls: false, autoRotate },
        scenes:  pannellumScenes,
    }, null, 2)
    const sceneListJson = JSON.stringify(sceneList)

    // Logo watermark — a fixed screen overlay, NOT a sphere hotspot.
    // Positioned by percent of the viewport (logo_x/logo_y), width in px (logo_size).
    const logoHtml = logoUrl
        ? `<div id="logoWM" style="left:${logoX}%;top:${logoY}%;width:${logoSize}px;"><img src="${escapeHtml(logoUrl)}" alt="" style="width:100%;"/></div>`
        : ''

    const introHtml = showIntro ? `<div id="introBox" style="display:none;position:fixed;inset:0;z-index:90000;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);font-family:'Poppins',-apple-system,sans-serif;"><div style="background:rgba(10,10,10,.85);border-radius:20px;padding:36px 44px;text-align:center;color:#fff;max-width:360px;"><div style="font-size:44px;margin-bottom:14px;">👆</div><p style="font-size:19px;font-weight:600;margin:0 0 8px">Tap arrows to move</p><p style="font-size:13px;opacity:.65;margin:0 0 24px">Drag anywhere to look around</p><button id="introDismiss" style="background:#3730a3;color:#fff;border:none;border-radius:30px;padding:11px 32px;font-size:15px;font-weight:600;cursor:pointer;">Got it</button></div></div>` : ''

    const introCode = showIntro ? `var _is=false;v.on('load',function(){if(!_is&&v.getScene()===C.default.firstScene){document.getElementById('introBox').style.display='flex';_is=true;}else{document.getElementById('introBox').style.display='none';}});document.getElementById('introDismiss').addEventListener('click',function(){document.getElementById('introBox').style.display='none';});` : ''

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(project.name)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css"/>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;font-family:'Poppins',-apple-system,sans-serif;background:#000}
#viewer{width:100vw;height:100vh}
#logoWM{position:fixed;transform:translate(-50%,-50%);z-index:15000;pointer-events:none;max-width:90vw;}
#logoWM img{display:block;width:100%;height:auto;opacity:.9;filter:drop-shadow(0 2px 8px rgba(0,0,0,.5));}
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
.pnlm-hotspot-base{cursor:pointer!important;background:none!important;border:none!important}
.pnlm-context-menu,.pnlm-load-box,.pnlm-about-msg{display:none!important}
</style>
</head>
<body>
<div id="loadOverlay"><div id="loadTitle">${escapeHtml(project.name)}</div><div id="loadPct">Loading… 0%</div><div id="loadBar"><div id="loadFill"></div></div></div>
<div id="rotateOverlay"><svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.4"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 17h.01"/></svg><p>Please rotate your device<br>to landscape mode</p></div>
${introHtml}
<div id="viewer"></div>
${logoHtml}
<div id="sceneSidebar"></div>
<div id="controls">
  <button class="ctrl" onclick="move('up')">▲</button><button class="ctrl" onclick="move('dn')">▼</button>
  <button class="ctrl" onclick="move('lt')">◀</button><button class="ctrl" onclick="move('rt')">▶</button>
  <button class="ctrl" onclick="move('zi')">+</button><button class="ctrl" onclick="move('zo')">−</button>
  <button class="ctrl" onclick="toggleFS()">⛶</button>
</div>
<script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
<script>
var C=${configJson};var SM=${sceneListJson};
function makeHotspotTooltip(div,a){var S=a.size||90;div.style.cssText='width:'+S+'px;height:'+S+'px;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;';var img=document.createElement('img');img.src=a.gif;img.style.cssText='width:'+S+'px;height:'+S+'px;object-fit:contain;filter:drop-shadow(0 3px 12px rgba(0,0,0,.85));pointer-events:none;';div.appendChild(img);if(a.label){var tip=document.createElement('div');tip.textContent=a.label;tip.style.cssText='position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:6px;white-space:nowrap;background:rgba(26,26,24,.92);color:#fff;font:600 12px/1.2 sans-serif;padding:5px 9px;border-radius:8px;opacity:0;transition:opacity .15s;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.4);z-index:10;';div.appendChild(tip);}var sh='drop-shadow(0 3px 12px rgba(0,0,0,.85))';div.addEventListener('mouseenter',function(){img.style.filter=sh+' brightness(1.2)';if(a.label)tip.style.opacity='1';});div.addEventListener('mouseleave',function(){img.style.filter=sh;if(a.label)tip.style.opacity='0';});div.addEventListener('click',function(){if(a.targetSceneId)v.loadScene(a.targetSceneId);});}
Object.values(C.scenes).forEach(function(s){(s.hotSpots||[]).forEach(function(h){h.createTooltipFunc=makeHotspotTooltip;});});
var _l=0,_t=SM.length;
function _onLoad(){_l++;var p=Math.round(_l/_t*100);document.getElementById('loadPct').textContent='Loading\u2026 '+p+'%';document.getElementById('loadFill').style.width=p+'%';if(_l>=_t)setTimeout(function(){document.getElementById('loadOverlay').style.display='none';},400);}
if(_t===0){document.getElementById('loadOverlay').style.display='none';}else{SM.forEach(function(s){var i=new Image();i.onload=i.onerror=_onLoad;i.src=s.url;});}
var v=pannellum.viewer('viewer',C);
SM.forEach(function(s){var d=document.createElement('div');d.className='ss-item';d.dataset.id=s.id;var img=document.createElement('img');img.src=s.url;img.alt=s.name;var lbl=document.createElement('span');lbl.textContent=s.name;d.appendChild(img);d.appendChild(lbl);d.addEventListener('click',function(){v.loadScene(s.id);});document.getElementById('sceneSidebar').appendChild(d);});
function _hl(id){document.querySelectorAll('.ss-item').forEach(function(el){el.classList.toggle('active',el.dataset.id===id);});}
v.on('scenechange',_hl);_hl(C.default.firstScene);
${introCode}
function move(d){var s=10;if(d==='up')v.setPitch(v.getPitch()+s);if(d==='dn')v.setPitch(v.getPitch()-s);if(d==='lt')v.setYaw(v.getYaw()-s);if(d==='rt')v.setYaw(v.getYaw()+s);if(d==='zi')v.setHfov(v.getHfov()-s);if(d==='zo')v.setHfov(v.getHfov()+s);}
function toggleFS(){if(!document.fullscreenElement){document.documentElement.requestFullscreen().catch(function(){});}else{document.exitFullscreen();}}
document.addEventListener('fullscreenchange',function(){var fs=document.fullscreenElement,sb=document.getElementById('sceneSidebar'),ct=document.getElementById('controls'),lg=document.getElementById('logoWM');if(fs){if(sb&&!fs.contains(sb))fs.appendChild(sb);if(ct&&!fs.contains(ct))fs.appendChild(ct);if(lg&&!fs.contains(lg))fs.appendChild(lg);}else{if(sb)document.body.appendChild(sb);if(ct)document.body.appendChild(ct);if(lg)document.body.appendChild(lg);}});
function _chk(){var l=window.innerWidth>window.innerHeight;document.getElementById('rotateOverlay').style.display=l?'none':'flex';}
window.addEventListener('orientationchange',function(){setTimeout(_chk,300);});window.addEventListener('resize',function(){setTimeout(_chk,300);});setTimeout(_chk,300);
</script></body></html>`
}