// components/360editor/site/site_shell.jsx
// Fonts + shared page styles + nav + footer + the progressive-enhancement script,
// in one wrapper so every public page (landing, /how-it-works, /pricing) looks
// and behaves identically. Server component — no hooks, no 'use client'.
//
// IMPORTANT: the reveal script must ship on every page that uses [data-reveal],
// otherwise those blocks stay at opacity 0.
import Script from 'next/script'
import SiteNav from '@/components/360editor/site/site_nav'
import SiteFooter from '@/components/360editor/site/site_footer'

const SITE_JS = `(function(){
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

export default function SiteShell({ user, active, children }) {
    return (
        <div className="min-h-screen bg-[#FAFAF7] overflow-x-hidden flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
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

            <SiteNav user={user} active={active} />

            <main className="flex-1">{children}</main>

            <SiteFooter />

            <Script id="site-enhance" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: SITE_JS }} />
        </div>
    )
}