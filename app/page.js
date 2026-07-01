// app/page.js  — public landing page
// Lean + human: what it is, why you'd use it, the steps — plus a real live demo.
import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import Script from 'next/script'
import { Button } from '@/components/ui/button'

// ───────────────────────────────────────────────────────────────────────────
// LIVE 360° TOUR DEMO — a real interactive tour (same Pannellum the editor uses),
// with procedurally-painted rooms + arrow hotspots. Fully self-contained iframe.
// ───────────────────────────────────────────────────────────────────────────
const TOUR_DEMO_HTML = `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css"/>
<style>
  html,body{margin:0;height:100%;background:#0d0c14;overflow:hidden;font-family:Inter,system-ui,sans-serif}
  #pano{position:absolute;inset:0}
  .pnlm-load-box{background:#13121c!important}
  .navarrow{width:62px;height:62px;cursor:pointer;display:flex;align-items:center;justify-content:center;
    border-radius:50%;background:rgba(55,48,163,.30);border:1.5px solid rgba(255,255,255,.55);
    backdrop-filter:blur(4px);transition:transform .18s ease, background .18s ease, box-shadow .18s ease;
    box-shadow:0 6px 22px rgba(0,0,0,.35), 0 0 0 6px rgba(163,230,53,0);animation:pulse 2.6s ease-in-out infinite}
  .navarrow:hover{background:rgba(55,48,163,.85);transform:scale(1.12);box-shadow:0 10px 30px rgba(0,0,0,.5),0 0 0 6px rgba(163,230,53,.18)}
  .navarrow svg{width:26px;height:26px;stroke:#fff;fill:none;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))}
  .navlabel{position:absolute;top:74px;left:50%;transform:translateX(-50%);white-space:nowrap;
    background:rgba(13,12,20,.82);color:#fff;font-size:11px;font-weight:600;letter-spacing:.3px;
    padding:4px 9px;border-radius:7px;border:1px solid rgba(255,255,255,.14)}
  @keyframes pulse{0%,100%{box-shadow:0 6px 22px rgba(0,0,0,.35),0 0 0 6px rgba(163,230,53,0)}
    50%{box-shadow:0 6px 22px rgba(0,0,0,.35),0 0 0 9px rgba(163,230,53,.10)}}
  .scenechip{position:absolute;left:14px;top:14px;z-index:5;display:flex;gap:6px;align-items:center;
    background:rgba(13,12,20,.7);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.12);
    color:#fff;font-size:12px;font-weight:600;padding:7px 12px;border-radius:999px}
  .scenechip .dot{width:7px;height:7px;border-radius:50%;background:#a3e635;box-shadow:0 0 8px #a3e635}
  .hint{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:5;
    background:rgba(13,12,20,.7);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.12);
    color:#cfcfe6;font-size:11.5px;font-weight:500;padding:6px 13px;border-radius:999px;
    display:flex;gap:7px;align-items:center;animation:fadehint 5s ease forwards}
  @keyframes fadehint{0%,72%{opacity:1}100%{opacity:0}}
  .badge360{position:absolute;right:14px;top:14px;z-index:5;background:rgba(55,48,163,.9);
    color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;padding:6px 11px;border-radius:8px}
</style></head><body>
<div id="pano"></div>
<div class="scenechip" id="chip"><span class="dot"></span><span id="chiptxt">Living Room</span></div>
<div class="badge360">360°</div>
<div class="hint"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a3e635" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>Drag to look around &middot; click an arrow to walk through</div>
<script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
<script>
function makeRoom(opt){
  var W=2048,H=1024,c=document.createElement('canvas');c.width=W;c.height=H;
  var x=c.getContext('2d');var hz=H*0.52;
  var cg=x.createLinearGradient(0,0,0,hz);cg.addColorStop(0,opt.ceil1);cg.addColorStop(1,opt.ceil2);
  x.fillStyle=cg;x.fillRect(0,0,W,hz);
  var fg=x.createLinearGradient(0,hz,0,H);fg.addColorStop(0,opt.floor1);fg.addColorStop(1,opt.floor2);
  x.fillStyle=fg;x.fillRect(0,hz,W,H-hz);
  x.strokeStyle=opt.grid;x.lineWidth=2;x.globalAlpha=.55;
  for(var i=0;i<=24;i++){var gx=i/24*W;x.beginPath();x.moveTo(gx,hz);
    x.lineTo(W/2+(gx-W/2)*3.0,H);x.stroke();}
  for(var j=1;j<=7;j++){var t=j/7;var gy=hz+(H-hz)*t*t;x.beginPath();x.moveTo(0,gy);x.lineTo(W,gy);x.stroke();}
  x.globalAlpha=1;
  var hg=x.createLinearGradient(0,hz-90,0,hz+90);hg.addColorStop(0,'rgba(0,0,0,0)');
  hg.addColorStop(.5,opt.glow);hg.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=hg;x.fillRect(0,hz-90,W,180);
  var panels=opt.panels||6;
  for(var p=0;p<panels;p++){
    var pw=W/panels, px=p*pw+pw*0.16, ph=hz*0.62, py=hz-ph-10, w=pw*0.68;
    x.fillStyle=(p%2===0)?opt.panelA:opt.panelB;
    roundRect(x,px,py,w,ph,14);x.fill();
    x.fillStyle=opt.accent;x.globalAlpha=.85;
    roundRect(x,px+w*0.18,py+ph*0.16,w*0.64,ph*0.5,10);x.fill();x.globalAlpha=1;
  }
  for(var f=0;f<opt.furn;f++){
    var fx=(f+0.5)/opt.furn*W, fw=W/opt.furn*0.42, fy=hz+(H-hz)*0.30, fh=(H-hz)*0.34;
    x.fillStyle=opt.furnCol;x.globalAlpha=.9;
    roundRect(x,fx-fw/2,fy,fw,fh,18);x.fill();x.globalAlpha=1;
  }
  var vg=x.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,W*0.62);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.34)');
  x.fillStyle=vg;x.fillRect(0,0,W,H);
  return c.toDataURL('image/jpeg',0.86);
}
function roundRect(x,a,b,w,h,r){x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);
  x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath();}

var living={ceil1:'#2a2740',ceil2:'#4a4368',floor1:'#6b5b46',floor2:'#3d3225',grid:'#b89b73',
  glow:'rgba(163,230,53,.10)',panelA:'#37334f',panelB:'#423c5d',accent:'#8a7fc4',
  furnCol:'#241f33',furn:3,panels:6};
var hallway={ceil1:'#1f2436',ceil2:'#3a4566',floor1:'#4a5570',floor2:'#272d40',grid:'#7d8cb0',
  glow:'rgba(99,102,241,.16)',panelA:'#2c3450',panelB:'#36406090',accent:'#9fb4ff',
  furnCol:'#1a1f30',furn:2,panels:8};
var balcony={ceil1:'#3a5a7a',ceil2:'#9fc6e8',floor1:'#7a6a52',floor2:'#4a4030',grid:'#cdb38a',
  glow:'rgba(255,221,150,.22)',panelA:'#5b769280',panelB:'#7fa2c080',accent:'#ffe6a8',
  furnCol:'#2e2820',furn:2,panels:5};

var SC={
  living:{title:'Living Room',panorama:makeRoom(living),autoLoad:true,autoRotate:-2.5,
    hotSpots:[mk(2,-118,'hallway','left','Hallway'),mk(0,42,'balcony','up','Balcony')]},
  hallway:{title:'Hallway',panorama:makeRoom(hallway),autoRotate:-2.5,
    hotSpots:[mk(0,8,'living','up','Living Room'),mk(2,150,'balcony','up-right','Balcony')]},
  balcony:{title:'Balcony',panorama:makeRoom(balcony),autoRotate:-2.5,
    hotSpots:[mk(2,178,'living','left','Back inside')]}
};
function mk(pitch,yaw,target,dir,label){
  return {pitch:pitch,yaw:yaw,type:'custom',cssClass:'nav',
    createTooltipFunc:arrowTip,createTooltipArgs:{target:target,dir:dir,label:label}};
}
var DIRS={
  up:'M12 19V5M5 12l7-7 7 7',
  left:'M19 12H5M12 19l-7-7 7-7',
  'up-right':'M7 17L17 7M7 7h10v10',
  'up-left':'M17 17L7 7M17 7H7v10'
};
function arrowTip(div,args){
  div.classList.add('navarrow');
  div.innerHTML='<svg viewBox="0 0 24 24"><path d="'+(DIRS[args.dir]||DIRS.up)+'"/></svg>'+
                '<span class="navlabel">'+args.label+'</span>';
  div.addEventListener('click',function(){viewer.loadScene(args.target);setChip(args.target);});
}
function setChip(id){document.getElementById('chiptxt').textContent=SC[id].title;}

var viewer=pannellum.viewer('pano',{
  "default":{firstScene:'living',sceneFadeDuration:900,autoLoad:true,
    showControls:false,compass:false,hfov:100,minHfov:62,maxHfov:118,friction:0.16},
  scenes:SC
});
viewer.on('scenechange',function(id){setChip(id);});
</script></body></html>`

// Scroll-reveal + avatar sign-out (progressive enhancement; safe in a server component)
const REVEAL_JS = `(function(){
  var io=new IntersectionObserver(function(es){es.forEach(function(e){
    if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:0.12});
  function run(){
    document.querySelectorAll('[data-reveal]').forEach(function(el){io.observe(el);});
    var out=document.getElementById('landing-signout');
    if(out){out.addEventListener('click',function(){
      out.textContent='Signing out…';
      fetch('/api/logout',{method:'POST'}).then(function(){location.href='/';})
        .catch(function(){location.href='/';});
    });}
    document.addEventListener('click',function(ev){
      var m=document.querySelector('.avatar-menu[open]');
      if(m&&!m.contains(ev.target))m.removeAttribute('open');
    });
  }
  if(document.readyState!=='loading')run();else document.addEventListener('DOMContentLoaded',run);
})();`

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
        .from('profiles').select('email, first_name, last_name').eq('id', user.id).single()
    profile = data ?? null
  }
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
  const initials = displayName
      ? displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
      : (profile?.email?.[0] || user?.email?.[0] || '?').toUpperCase()

  const primaryHref  = user ? '/360editor' : '/signup'
  const primaryLabel = user ? 'Go to your dashboard →' : 'Build your first tour →'

  return (
      <div className="min-h-screen bg-[#FAFAF7] overflow-x-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
            href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap"
            rel="stylesheet"
        />
        <style>{`
          .serif{font-family:'Fraunces',Georgia,serif}
          .fade-up{opacity:0;transform:translateY(18px);animation:fadeUp .8s cubic-bezier(.16,1,.3,1) forwards}
          @keyframes fadeUp{to{opacity:1;transform:none}}
          [data-reveal]{opacity:0;transform:translateY(24px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1)}
          [data-reveal].in{opacity:1;transform:none}
          .glow-indigo{box-shadow:0 30px 80px -28px rgba(55,48,163,.55)}
          .grain:before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.5;
            background-image:radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px);background-size:3px 3px}
          @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
          @keyframes dropIn{0%{opacity:0;transform:translateY(-14px) scale(.96)}100%{opacity:1;transform:none}}
          @keyframes arrowPop{0%,40%{opacity:0;transform:scale(.4)}55%{opacity:1;transform:scale(1.15)}70%,100%{opacity:1;transform:scale(1)}}
          @keyframes barFill{from{width:14%}to{width:100%}}
          @keyframes glowPulse{0%,100%{opacity:.55}50%{opacity:1}}
          .avatar-menu>summary{list-style:none}
          .avatar-menu>summary::-webkit-details-marker{display:none}
          .avatar-menu[open]>summary:before{content:'';position:fixed;inset:0;z-index:40;cursor:default}
          @media (prefers-reduced-motion: reduce){
            .fade-up,[data-reveal]{animation:none!important;transition:none!important;opacity:1!important;transform:none!important}
          }
          @media (scripting: none){[data-reveal]{opacity:1!important;transform:none!important}}
        `}</style>

        {/* ── NAV ── */}
        <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-lg border-b border-[#E2E2DA]">
          <div className="max-w-5xl mx-auto px-6 h-[60px] flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 no-underline group">
              <div className="w-8 h-8 bg-[#3730a3] rounded-lg flex items-center justify-center transition-colors group-hover:bg-[#312e81]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </div>
              <span className="text-[#1a1a18] font-bold text-[18px] tracking-tight">360<span className="text-[#3730a3]">Editor</span></span>
            </Link>

            {user ? (
                <details className="avatar-menu relative">
                  <summary className="list-none cursor-pointer w-9 h-9 rounded-full bg-[#3730a3] text-white text-sm font-bold flex items-center justify-center hover:bg-[#312e81] transition-colors select-none">
                    {initials}
                  </summary>
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-[#E2E2DA] rounded-xl shadow-xl overflow-hidden z-50">
                    <div className="px-3.5 py-3 border-b border-[#E2E2DA]">
                      <p className="text-[13px] font-semibold text-[#1a1a18] truncate">{displayName || 'My Account'}</p>
                      <p className="text-[11.5px] text-[#6b6b60] truncate">{profile?.email || user.email}</p>
                    </div>
                    <Link href="/360editor" className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-[#1a1a18] hover:bg-[#F4F4EF] no-underline">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                      Your projects
                    </Link>
                    <button id="landing-signout" type="button" className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-red-600 hover:bg-red-50 bg-transparent border-none cursor-pointer text-left">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                      Sign out
                    </button>
                  </div>
                </details>
            ) : (
                <div className="flex items-center gap-2.5">
                  <Button asChild variant="ghost" className="text-[14px] text-[#1a1a18] hover:bg-[#F4F4EF] h-9">
                    <Link href="/login">Log in</Link>
                  </Button>
                  <Button asChild className="bg-[#3730a3] hover:bg-[#312e81] text-white text-[14px] h-9 px-4 rounded-lg">
                    <Link href="/signup">Sign up free</Link>
                  </Button>
                </div>
            )}
          </div>
        </nav>

        {/* ── HERO: what it is + the demo ── */}
        <section className="relative grain overflow-hidden bg-[#0d0c14]">
          <div className="pointer-events-none absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full blur-[120px]" style={{ background:'radial-gradient(circle,rgba(55,48,163,.55),transparent 70%)' }} />
          <div className="pointer-events-none absolute top-10 right-[-120px] w-[420px] h-[420px] rounded-full blur-[130px]" style={{ background:'radial-gradient(circle,rgba(163,230,53,.14),transparent 70%)' }} />

          <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-20 grid lg:grid-cols-[1fr_1.2fr] gap-12 items-center">
            <div>
              <h1 className="serif text-white text-[clamp(38px,5vw,60px)] font-semibold leading-[1.06] tracking-[-1.4px] mb-5 fade-up" style={{ animationDelay:'.05s' }}>
                Turn your 360° photos into a tour people can <span className="text-[#a9a2ff]">walk through</span>.
              </h1>
              <p className="text-[17px] text-[#b9b9cc] max-w-[460px] leading-relaxed mb-8 fade-up" style={{ animationDelay:'.1s' }}>
                Upload your panoramas, connect the rooms with arrows, drop your logo on top,
                and download one file you can put on any website. No code. No plugins.
                No monthly fee while it&apos;s in beta.
              </p>
              <div className="flex items-center gap-3 flex-wrap mb-8 fade-up" style={{ animationDelay:'.15s' }}>
                <Button asChild className="bg-[#3730a3] hover:bg-[#4338ca] text-white h-12 px-7 text-[15px] font-semibold rounded-xl glow-indigo">
                  <Link href={primaryHref}>{primaryLabel}</Link>
                </Button>
                <a href="#demo" className="text-[14px] text-[#cfcfe6] hover:text-white underline underline-offset-4 decoration-white/30">
                  or try the live one →
                </a>
              </div>
              <div className="flex items-center gap-5 text-[12.5px] text-[#9a9ab2] fade-up" style={{ animationDelay:'.2s' }}>
                <span className="flex items-center gap-1.5"><Check/> Up to 30 rooms</span>
                <span className="flex items-center gap-1.5"><Check/> One-click export</span>
                <span className="flex items-center gap-1.5"><Check/> Yours to keep</span>
              </div>
            </div>

            <div id="demo" className="fade-up" style={{ animationDelay:'.12s' }}>
              <div className="relative rounded-2xl overflow-hidden border border-white/12 bg-[#13121c] shadow-2xl glow-indigo" style={{ animation:'floatY 7s ease-in-out infinite' }}>
                <div className="flex items-center gap-1.5 px-4 h-9 bg-[#1a1830] border-b border-white/8">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                  <span className="ml-3 text-[11.5px] text-[#8a8aa6] font-medium">my-apartment-tour.html</span>
                </div>
                <iframe
                    title="Live 360° virtual tour demo"
                    srcDoc={TOUR_DEMO_HTML}
                    className="w-full block bg-[#0d0c14]"
                    style={{ height: '420px', border: 0 }}
                    loading="lazy"
                    sandbox="allow-scripts allow-same-origin"
                />
              </div>
              <p className="text-center text-[12px] text-[#7e7e98] mt-3">
                This is a real tour, not a video — drag to look, click an arrow to change rooms.
              </p>
            </div>
          </div>
        </section>

        {/* ── WHY: three honest reasons ── */}
        <section className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="serif text-[clamp(24px,3.4vw,34px)] font-semibold text-[#1a1a18] tracking-[-0.5px] mb-2 text-center" data-reveal>
            Why people actually use it
          </h2>
          <p className="text-[15px] text-[#6b6b60] text-center max-w-[460px] mx-auto mb-12" data-reveal>
            It&apos;s built to get a finished, shareable tour into your hands — not to lock you into a subscription.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              ['You own the result',
                'Export gives you one self-contained HTML file. Put it on your site, email it to a client, or keep it on a USB stick — it keeps working with nothing tied back to us.'],
              ['The hard part is just dragging',
                'Drop an arrow where a doorway is, pick the room it leads to, done. If you can move a file on your desktop, you can build the navigation.'],
              ['Made for client work',
                'Add your logo as a watermark, choose where the tour opens, size your arrows, and it plays fine on a phone. Hand it over and it looks like yours.'],
            ].map(([title, body]) => (
                <div key={title} className="bg-white border border-[#E2E2DA] rounded-2xl p-6" data-reveal>
                  <div className="w-9 h-9 rounded-xl bg-[#3730a3]/8 flex items-center justify-center mb-4">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <h3 className="text-[16px] font-semibold text-[#1a1a18] mb-2">{title}</h3>
                  <p className="text-[14px] text-[#6b6b60] leading-relaxed">{body}</p>
                </div>
            ))}
          </div>
        </section>

        {/* ── INSIDE THE EDITOR: how it looks + how it works ── */}
        <section id="steps" className="bg-white border-y border-[#E2E2DA]">
          <div className="max-w-5xl mx-auto px-6 py-20">
            <h2 className="serif text-[clamp(24px,3.4vw,34px)] font-semibold text-[#1a1a18] tracking-[-0.5px] mb-2 text-center" data-reveal>
              Here&apos;s the editor you&apos;ll be working in
            </h2>
            <p className="text-[15px] text-[#6b6b60] text-center max-w-[500px] mx-auto mb-10" data-reveal>
              Three panels, one screen. Scenes on the left, your live 360° view in the middle,
              arrows and branding on the right.
            </p>

            {/* Editor mockup */}
            <div className="rounded-2xl border border-[#E2E2DA] shadow-xl overflow-hidden mb-12" data-reveal>
              <div className="flex items-center justify-between px-4 h-11 bg-[#F4F4EF] border-b border-[#E2E2DA]">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[#1a1a18]">
                  <span className="w-2 h-2 rounded-full bg-[#3730a3]" /> Apartment Tour
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] border border-[#E2E2DA] bg-white text-[#1a1a18] px-3 py-1 rounded-lg font-medium">Preview</span>
                  <span className="text-[12px] bg-[#3730a3] text-white px-3 py-1 rounded-lg font-medium">Export HTML</span>
                </div>
              </div>

              <div className="grid grid-cols-[130px_1fr_150px] md:grid-cols-[190px_1fr_210px] h-[300px] md:h-[360px]">
                {/* LEFT — scenes */}
                <div className="border-r border-[#E2E2DA] bg-[#FAFAF7] p-3 overflow-hidden">
                  <div className="text-[10px] font-bold tracking-widest text-[#9a9a8e] uppercase mb-2.5">Scenes</div>
                  {[['Living Room','#4a4368','0s',true],['Hallway','#3a4566','.5s',false],['Balcony','#9fc6e8','1s',false]].map(([name,col,d,active]) => (
                      <div key={name} className="flex items-center gap-2 mb-2 p-1.5 rounded-lg border border-[#E2E2DA] bg-white"
                           style={{ animation:`dropIn .6s ease ${d} both`, boxShadow: active ? '0 0 0 2px #3730a3' : 'none' }}>
                        <span className="w-9 h-7 rounded-md shrink-0" style={{ background:col }} />
                        <span className="text-[11px] text-[#1a1a18] font-medium truncate">{name}</span>
                      </div>
                  ))}
                  <div className="mt-2 border-2 border-dashed border-[#cdcdc2] rounded-lg py-3 text-center text-[10px] text-[#9a9a8e]"
                       style={{ animation:'glowPulse 2.4s ease-in-out infinite 1.4s' }}>
                    + Upload panorama
                  </div>
                </div>

                {/* MIDDLE — viewer */}
                <div className="relative overflow-hidden" style={{ background:'radial-gradient(120% 90% at 50% 30%, #4a4368 0%, #2a2740 55%, #15131f 100%)' }}>
                  <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ backgroundImage:'repeating-linear-gradient(90deg,transparent 0 38px,rgba(184,155,115,.18) 38px 40px)' }} />
                  {/* arrow with hover-style label */}
                  <div className="absolute left-[30%] top-[52%] flex flex-col items-center" style={{ animation:'arrowPop 4s ease-in-out infinite' }}>
                    <span className="mb-1 text-[10px] font-semibold text-white bg-black/60 px-2 py-0.5 rounded-md whitespace-nowrap">Go to Hallway</span>
                    <div className="w-11 h-11 rounded-full flex items-center justify-center border-[1.5px] border-white/60" style={{ background:'rgba(55,48,163,.55)', backdropFilter:'blur(3px)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    </div>
                  </div>
                  <div className="absolute left-[60%] top-[40%]" style={{ animation:'arrowPop 4s ease-in-out infinite 1.3s' }}>
                    <div className="w-11 h-11 rounded-full flex items-center justify-center border-[1.5px] border-white/60" style={{ background:'rgba(55,48,163,.55)', backdropFilter:'blur(3px)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                    </div>
                  </div>
                  <div className="absolute right-4 bottom-3 text-white/85 font-bold text-[12px] flex items-center gap-1.5" style={{ animation:'dropIn .7s ease 1.8s both' }}>
                    <span className="w-4 h-4 rounded bg-[#a3e635]" /> YOUR LOGO
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 top-3 text-[10.5px] text-white/80 bg-black/35 px-3 py-1 rounded-full backdrop-blur">
                    Living Room · drag to look around
                  </div>
                </div>

                {/* RIGHT — directions */}
                <div className="border-l border-[#E2E2DA] bg-[#FAFAF7] p-3 overflow-hidden">
                  <div className="text-[10px] font-bold tracking-widest text-[#9a9a8e] uppercase mb-2">Directions</div>
                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    {['M12 19V5M5 12l7-7 7 7','M19 12H5M12 19l-7-7 7-7','M7 17L17 7M7 7h10v10','M17 17L7 7M17 7H7v10'].map((d,i)=>(
                        <div key={i} className="aspect-square rounded-lg border border-[#E2E2DA] bg-white flex items-center justify-center"
                             style={{ animation:`dropIn .5s ease ${0.2*i}s both`, boxShadow:i===0?'0 0 0 2px #3730a3':'none' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
                        </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold tracking-widest text-[#9a9a8e] uppercase">Hotspot size</span>
                    <span className="text-[9px] text-[#9a9a8e] font-mono">90px</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#E2E2DA] overflow-hidden mb-3">
                    <div className="h-full bg-[#3730a3] rounded-full" style={{ animation:'barFill 2.6s ease-in-out infinite alternate' }} />
                  </div>
                  <div className="text-[10px] font-bold tracking-widest text-[#9a9a8e] uppercase mb-1.5">Placed</div>
                  {['→ Hallway','↑ Balcony'].map((t,i)=>(
                      <div key={t} className="text-[11px] text-[#1a1a18] bg-white border border-[#E2E2DA] rounded-md px-2 py-1.5 mb-1.5" style={{ animation:`dropIn .5s ease ${0.6+0.3*i}s both` }}>{t}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Steps tied to the editor */}
            <h3 className="serif text-[20px] font-semibold text-[#1a1a18] text-center mb-8" data-reveal>
              And here&apos;s how you use it — four steps
            </h3>
            <div className="grid md:grid-cols-2 gap-5">
              {[
                ['1','Add your scenes','Upload a 360° photo for each room into the left panel — up to 30 in one tour. Click a scene to open it in the middle viewer.'],
                ['2','Drop the arrows','Drag an arrow from the right panel onto a doorway in the view, then pick the room it leads to. That link is your navigation.'],
                ['3','Brand and adjust','Add your logo and drag it where you want, set one size for all arrows, choose the auto-spin, and give each arrow a label.'],
                ['4','Preview, then export','Hit Preview to walk the finished tour, then Export to download one HTML file you can host or send anywhere.'],
              ].map(([n, title, body]) => (
                  <div key={n} className="flex gap-4 bg-[#FAFAF7] border border-[#E2E2DA] rounded-2xl p-5" data-reveal>
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-[#3730a3] text-white flex items-center justify-center font-bold text-[15px]">{n}</div>
                    <div>
                      <h4 className="text-[15.5px] font-semibold text-[#1a1a18] mb-1">{title}</h4>
                      <p className="text-[14px] text-[#6b6b60] leading-relaxed">{body}</p>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="max-w-5xl mx-auto px-6 py-20">
          <div className="relative rounded-3xl overflow-hidden bg-[#3730a3] text-center px-6 py-14 glow-indigo grain" data-reveal>
            <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full blur-[90px]" style={{ background:'radial-gradient(circle,rgba(163,230,53,.28),transparent 70%)' }} />
            <h2 className="serif relative text-white text-[clamp(26px,4vw,40px)] font-semibold tracking-[-0.8px] mb-4 leading-[1.1]">
              Give it a try with your own photos.
            </h2>
            <p className="relative text-[16px] text-white/80 max-w-[420px] mx-auto mb-8">
              Free while it&apos;s in beta. Upload a panorama and you&apos;ll have a shareable tour in minutes.
            </p>
            <div className="relative flex items-center justify-center gap-3 flex-wrap">
              <Button asChild className="bg-white hover:bg-[#f4f4ef] text-[#3730a3] h-12 px-8 text-[15px] font-bold rounded-xl">
                <Link href={primaryHref}>{user ? 'Go to dashboard →' : 'Start for free →'}</Link>
              </Button>
              {!user && (
                  <Button asChild variant="outline" className="h-12 px-8 text-[15px] border-white/40 bg-transparent text-white hover:bg-white/12 rounded-xl">
                    <Link href="/login">Log in</Link>
                  </Button>
              )}
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="border-t border-[#E2E2DA] bg-white">
          <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5 no-underline">
              <div className="w-7 h-7 bg-[#3730a3] rounded-lg flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </div>
              <span className="text-[#1a1a18] font-bold text-[15px]">360<span className="text-[#3730a3]">Editor</span></span>
            </Link>
            <div className="flex items-center gap-6 text-[13px] text-[#6b6b60]">
              <a href="#steps" className="hover:text-[#3730a3]">How it works</a>
              <Link href="/privacy" className="hover:text-[#3730a3]">Privacy</Link>
              <Link href="/terms" className="hover:text-[#3730a3]">Terms</Link>
            </div>
            <span className="text-[12.5px] text-[#9a9a8e]">© {new Date().getFullYear()} 360Editor</span>
          </div>
        </footer>

        <Script id="landing-enhance" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: REVEAL_JS }} />
      </div>
  )
}

function Check() {
  return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
  )
}