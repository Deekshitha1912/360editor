// app/page.js — public landing page
// Pricing and How-it-works now live at /pricing and /how-it-works. The landing
// page keeps the hero + live demo and teases both, so nothing here is a dead end.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import SiteShell from '@/components/360editor/site/site_shell'

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

// Four steps, each with the one line that tells you what actually happens.
// `icon` is the SVG path data — drawn at 24×24, stroked, never filled.
const STEPS = [
  {
    n: '1',
    title: 'Upload your panoramas',
    sub: 'One 360° photo per room, up to 30 in a tour.',
    icon: <><path d="M12 16V4"/><path d="M8 8l4-4 4 4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></>,
  },
  {
    n: '2',
    title: 'Drag arrows onto doorways',
    sub: 'Point each one at the room it opens into.',
    icon: <><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></>,
  },
  {
    n: '3',
    title: 'Add your logo',
    sub: 'Place it, size it, pick where the tour opens.',
    icon: <><rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></>,
  },
  {
    n: '4',
    title: 'Publish or download',
    sub: 'A permanent link to send, or one file to keep.',
    icon: <><path d="M10 13a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.07 0l-2 2a5 5 0 0 0 7.07 7.07l1.1-1.1"/></>,
  },
]

const CREDIT_INCLUDES = [
  'Up to 30 rooms in the tour',
  'Unlimited edits and re-publishes',
  'Your logo, your arrow labels, no watermark from us',
]

export default async function Page({ searchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Old links pointed here with ?nocredits=1 for the #pricing anchor.
  // Pricing is its own page now, so forward them rather than 404 the intent.
  const sp = await searchParams
  if (sp?.nocredits === '1') redirect('/pricing?nocredits=1')

  const primaryHref  = user ? '/360editor' : '/signup'
  const primaryLabel = user ? 'Go to your dashboard →' : 'Build your first tour →'

  return (
      <SiteShell user={user ? { email: user.email } : null} active="/">

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
                and publish a link you can send to a client — or download the whole tour as
                one file. No code. No plugins. No monthly fee.
              </p>
              <div className="flex items-center gap-3 flex-wrap mb-8 fade-up" style={{ animationDelay:'.15s' }}>
                <Button asChild className="bg-[#3730a3] hover:bg-[#4338ca] text-white h-12 px-7 text-[15px] font-semibold rounded-xl glow-indigo">
                  <Link href={primaryHref}>{primaryLabel}</Link>
                </Button>
                <Button asChild className="bg-white hover:bg-[#f3e8ff] text-[#3730a3] h-12 px-7 text-[15px] font-semibold rounded-xl glow-indigo">
                  <Link href="/pricing">{user ? 'Buy credits' : 'See pricing'}</Link>
                </Button>
              </div>
              <div className="flex items-center gap-5 text-[12.5px] text-[#9a9ab2] fade-up" style={{ animationDelay:'.2s' }}>
                <span className="flex items-center gap-1.5"><Check/> Up to 30 rooms</span>
                <span className="flex items-center gap-1.5"><Check/> Permanent share link</span>
                <span className="flex items-center gap-1.5"><Check/> Yours to keep</span>
              </div>
            </div>

            <div id="demo" className="fade-up" style={{ animationDelay:'.12s' }}>
              <div className="relative rounded-2xl overflow-hidden border border-white/12 bg-[#13121c] shadow-2xl glow-indigo" style={{ animation:'floatY 7s ease-in-out infinite' }}>
                <div className="flex items-center gap-1.5 px-4 h-9 bg-[#1a1830] border-b border-white/8">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                  <span className="ml-3 text-[11.5px] text-[#8a8aa6] font-medium">my-apartment-tour</span>
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

        {/* ── HOW IT WORKS — teaser rail, full detail on its own page ── */}
        <section className="bg-white border-y border-[#E2E2DA]">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <div className="text-center mb-12" data-reveal>
              <span className="inline-block text-[11px] font-bold tracking-widest text-[#3730a3] uppercase mb-3">How it works</span>
              <h2 className="serif text-[clamp(24px,3.4vw,34px)] font-semibold text-[#1a1a18] tracking-[-0.5px] mb-3">
                From a folder of photos to a link you can send
              </h2>
              <p className="text-[15px] text-[#6b6b60] max-w-[440px] mx-auto leading-relaxed">
                If you can drag a file across your desktop, you can build the navigation.
                Most first tours take under twenty minutes.
              </p>
            </div>

            <div className="relative">
              {/* The thread running through the four icons — desktop only, where
                            the steps sit in one row and the line actually means something. */}
              <div
                  className="hidden md:block absolute left-[12.5%] right-[12.5%] top-[54px] h-px"
                  style={{ backgroundImage:'repeating-linear-gradient(90deg,#D8D8CE 0 6px,transparent 6px 12px)' }}
                  aria-hidden="true"
              />

              <div className="relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {STEPS.map(({ n, title, sub, icon }) => (
                    <div
                        key={n}
                        className="group relative bg-[#FAFAF7] border border-[#E2E2DA] rounded-2xl px-5 pt-7 pb-6 text-center transition-all hover:border-[#3730a3]/35 hover:bg-white hover:shadow-[0_10px_30px_rgba(55,48,163,0.08)]"
                        data-reveal
                    >
                      {/* Icon sits on the thread, so it needs an opaque backdrop */}
                      <div className="relative mx-auto mb-4 w-14 h-14 rounded-2xl bg-white border border-[#E2E2DA] flex items-center justify-center transition-colors group-hover:border-[#3730a3]/30">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {icon}
                        </svg>
                        <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#3730a3] text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">
                                            {n}
                                        </span>
                      </div>

                      <h3 className="text-[14px] font-semibold text-[#1a1a18] leading-snug mb-1.5">{title}</h3>
                      <p className="text-[12.5px] text-[#6b6b60] leading-relaxed">{sub}</p>
                    </div>
                ))}
              </div>
            </div>

            <div className="mt-11 flex flex-col sm:flex-row items-center justify-center gap-3" data-reveal>
              <Link href="/how-it-works" className="inline-flex items-center gap-1.5 h-11 px-6 rounded-xl bg-[#1a1a18] text-white text-[14px] font-semibold no-underline hover:bg-[#33332e] transition-colors">
                See the editor in detail
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </Link>
              <a href="#demo" className="inline-flex items-center gap-1.5 h-11 px-6 rounded-xl border border-[#E2E2DA] bg-white text-[#1a1a18] text-[14px] font-semibold no-underline hover:border-[#3730a3]/40 hover:text-[#3730a3] transition-colors">
                Try the live demo
              </a>
            </div>
          </div>
        </section>

        {/* ── PRICING TEASER — the numbers, then straight to checkout ── */}
        <section className="max-w-5xl mx-auto px-6 py-16">
          <div className="rounded-3xl border border-[#E2E2DA] bg-white overflow-hidden" data-reveal>
            <div className="grid md:grid-cols-[1fr_1fr]">

              {/* Left — what a credit actually buys */}
              <div className="p-8 md:p-10 flex flex-col">
                <span className="inline-block text-[11px] font-bold tracking-widest text-[#3730a3] uppercase mb-3">Pricing</span>
                <h2 className="serif text-[clamp(22px,3vw,30px)] font-semibold text-[#1a1a18] tracking-[-0.5px] mb-3 leading-tight">
                  Pay per tour. Nothing monthly.
                </h2>
                <p className="text-[14.5px] text-[#6b6b60] leading-relaxed mb-6">
                  One credit builds one tour. Spend it when you create the project, then edit and
                  re-publish that tour as often as you like — the price never comes back.
                </p>

                <ul className="space-y-2.5 mb-8">
                  {CREDIT_INCLUDES.map(item => (
                      <li key={item} className="flex items-start gap-2.5 text-[13.5px] text-[#3a3a35]">
                        <svg className="mt-[3px] shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                        {item}
                      </li>
                  ))}
                </ul>

                <div className="mt-auto flex items-center gap-3 flex-wrap">
                  <Link href="/pricing" className="inline-flex items-center justify-center gap-1.5 h-11 px-6 rounded-xl bg-[#3730a3] text-white text-[14.5px] font-bold no-underline hover:bg-[#312e81] transition-colors">
                    {user ? 'Buy credits' : 'See plans and buy'}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                  </Link>
                  {!user && (
                      <Link href="/signup" className="inline-flex items-center justify-center h-11 px-6 rounded-xl border border-[#E2E2DA] text-[#1a1a18] text-[14.5px] font-semibold no-underline hover:border-[#3730a3]/40 hover:text-[#3730a3] transition-colors">
                        Create an account
                      </Link>
                  )}
                </div>
              </div>

              {/* Right — the two plans, with the per-tour maths done for them */}
              <div className="border-t md:border-t-0 md:border-l border-[#E2E2DA] bg-[#FAFAF7] p-6 md:p-8 flex flex-col justify-center gap-3">

                <Link href="/pricing" className="group block rounded-2xl border border-[#E2E2DA] bg-white p-5 no-underline transition-all hover:border-[#3730a3]/40 hover:shadow-[0_8px_24px_rgba(55,48,163,0.08)]">
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <div className="text-[13.5px] font-semibold text-[#1a1a18]">Single project</div>
                      <div className="text-[12px] text-[#6b6b60] mt-0.5">1 credit · 1 tour</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="serif text-[27px] font-semibold text-[#1a1a18] leading-none">₹500</div>
                      <div className="text-[11px] text-[#9a9a8e] mt-1">₹500 per tour</div>
                    </div>
                  </div>
                </Link>

                <Link href="/pricing" className="group relative block rounded-2xl border-2 border-[#3730a3] bg-white p-5 no-underline transition-all hover:shadow-[0_10px_30px_rgba(55,48,163,0.16)]">
                                <span className="absolute -top-2.5 left-5 rounded-full bg-[#3730a3] px-2.5 py-0.5 text-[9.5px] font-bold tracking-wide text-white">
                                    BEST VALUE
                                </span>
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <div className="text-[13.5px] font-semibold text-[#1a1a18]">3 projects</div>
                      <div className="text-[12px] text-[#6b6b60] mt-0.5">3 credits · 3 tours</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-baseline justify-end gap-1.5">
                        <span className="text-[13px] text-[#9a9a8e] line-through">₹1500</span>
                        <span className="serif text-[27px] font-semibold text-[#1a1a18] leading-none">₹1000</span>
                      </div>
                      <div className="text-[11px] font-semibold text-[#3d8f4e] mt-1">₹333 per tour · save ₹500</div>
                    </div>
                  </div>
                </Link>

                <p className="text-center text-[11.5px] text-[#9a9a8e] mt-1">
                  Credits never expire · Secure checkout via Razorpay
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="max-w-5xl mx-auto px-6 pb-20">
          <div className="relative rounded-3xl overflow-hidden bg-[#3730a3] text-center px-6 py-14 glow-indigo grain" data-reveal>
            <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full blur-[90px]" style={{ background:'radial-gradient(circle,rgba(163,230,53,.28),transparent 70%)' }} />
            <h2 className="serif relative text-white text-[clamp(26px,4vw,40px)] font-semibold tracking-[-0.8px] mb-4 leading-[1.1]">
              Give it a try with your own photos.
            </h2>
            <p className="relative text-[16px] text-white/80 max-w-[420px] mx-auto mb-8">
              Upload a panorama and you&apos;ll have a shareable tour in minutes.
            </p>
            <div className="relative flex items-center justify-center gap-3 flex-wrap">
              <Button asChild className="bg-white hover:bg-[#f4f4ef] text-[#3730a3] h-12 px-8 text-[15px] font-bold rounded-xl">
                <Link href={primaryHref}>{user ? 'Go to dashboard →' : 'Start for free →'}</Link>
              </Button>
              <Button asChild variant="outline" className="h-12 px-8 text-[15px] border-white/40 bg-transparent text-white hover:bg-white/12 rounded-xl">
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>
          </div>
        </section>
      </SiteShell>
  )
}

function Check() {
  return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
  )
}